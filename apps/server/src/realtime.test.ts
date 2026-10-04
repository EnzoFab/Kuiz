import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { AddressInfo } from "node:net";
import { io as ioClient, type Socket } from "socket.io-client";
import { brickRegistry } from "@kuiz/bricks";
import type { SessionState } from "@kuiz/core";
import { buildApp } from "./app.js";
import { SessionStore } from "./sessions.js";
import { attachRealtime } from "./realtime.js";
import { demoGame } from "./demo.js";

interface JoinResult {
  sessionId?: string;
  code?: string;
  playerId?: string;
  hostId?: string;
  joinMode?: string;
  error?: string;
}

describe("realtime lifecycle", () => {
  const app = buildApp();
  const store = new SessionStore(brickRegistry.resolver());
  let io: ReturnType<typeof attachRealtime>;
  let url: string;

  beforeAll(async () => {
    await app.listen({ port: 0, host: "127.0.0.1" });
    io = attachRealtime(app.server, store, () => demoGame);
    const { port } = app.server.address() as AddressInfo;
    url = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await io.close();
    await app.close();
  });

  const connect = (): Promise<Socket> =>
    new Promise((resolve) => {
      const socket = ioClient(url, { transports: ["websocket"] });
      socket.on("connect", () => resolve(socket));
    });

  const emit = <T>(socket: Socket, event: string, payload: unknown): Promise<T> =>
    new Promise((resolve) => socket.emit(event, payload, resolve));

  it("host creates, player joins, host starts, and both see playing state with scores", async () => {
    const host = await connect();
    const created = await emit<JoinResult>(host, "create", { nickname: "GM" });
    expect(created.code).toMatch(/^[A-Z0-9]{4}$/);
    expect(created.hostId).toBe(created.playerId);

    const player = await connect();
    const joined = await emit<JoinResult>(player, "join", { code: created.code, nickname: "Al" });
    expect(joined.sessionId).toBe(created.sessionId);
    expect(joined.hostId).toBe(created.hostId);

    // Player should receive playing state after the host starts.
    const playerPlaying = new Promise<SessionState>((resolve) => {
      player.on("state", ({ state }: { state: SessionState }) => {
        if (state.phase === "playing") {
          resolve(state);
        }
      });
    });
    host.emit("event", { event: { type: "START" } });
    const state = await playerPlaying;
    expect(state.phase).toBe("playing");
    expect(Object.keys(state.players)).toContain(joined.playerId);

    host.close();
    player.close();
  });

  it("rejoining with the same playerId reconnects rather than duplicating", async () => {
    const host = await connect();
    const created = await emit<JoinResult>(host, "create", { nickname: "GM" });

    const p1 = await connect();
    const j1 = await emit<JoinResult>(p1, "join", { code: created.code, nickname: "Al" });
    p1.close();

    const p2 = await connect();
    const j2 = await emit<JoinResult>(p2, "join", {
      code: created.code,
      nickname: "Al",
      playerId: j1.playerId,
    });
    expect(j2.playerId).toBe(j1.playerId); // same identity restored

    host.close();
    p2.close();
  });

  it("returns an error for an unknown code", async () => {
    const client = await connect();
    const result = await emit<JoinResult>(client, "join", { code: "ZZZZ", nickname: "x" });
    expect(result.error).toBe("Session not found");
    client.close();
  });

  it("private mode: host sets a roster, a player watches then claims a slot, and reconnects to it", async () => {
    const host = await connect();
    const created = await emit<JoinResult>(host, "create", { nickname: "GM", roster: ["Alice", "Bob"] });
    expect(created.joinMode).toBe("private");

    const nextState = (s: Socket) =>
      new Promise<SessionState>((resolve) =>
        s.once("state", ({ state }: { state: SessionState }) => resolve(state)),
      );

    const player = await connect();
    const rosterPromise = nextState(player); // listen before emitting (broadcast fires immediately)
    const watched = await emit<JoinResult>(player, "watch", { code: created.code });
    expect(watched.joinMode).toBe("private");

    const roster = await rosterPromise;
    const slotId = Object.entries(roster.players).find(([, p]) => p.claimed === false)?.[0];
    expect(slotId).toBeDefined();

    const afterClaimPromise = nextState(player);
    const claimed = await emit<JoinResult>(player, "claim", { playerSlotId: slotId });
    expect(claimed.playerId).toBe(slotId);
    const afterClaim = await afterClaimPromise;
    expect(afterClaim.players[slotId!]).toMatchObject({ claimed: true, isConnected: true });

    // Reconnect: a new socket watches and claims the same slot → same identity.
    player.close();
    const player2 = await connect();
    await emit(player2, "watch", { code: created.code });
    const reclaimed = await emit<JoinResult>(player2, "claim", { playerSlotId: slotId });
    expect(reclaimed.playerId).toBe(slotId);

    host.close();
    player2.close();
  });
});
