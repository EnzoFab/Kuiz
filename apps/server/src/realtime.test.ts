import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { AddressInfo } from "node:net";
import { io as ioClient, type Socket } from "socket.io-client";
import { brickRegistry } from "@kuiz/bricks";
import type { SessionState } from "@kuiz/core";
import { buildApp } from "./app.js";
import { SessionStore } from "./sessions.js";
import { attachRealtime } from "./realtime.js";
import { demoGame } from "./demo.js";

describe("realtime shell", () => {
  const app = buildApp();
  const store = new SessionStore(brickRegistry.resolver());
  const session = store.create(demoGame);
  let io: ReturnType<typeof attachRealtime>;
  let url: string;

  beforeAll(async () => {
    await app.listen({ port: 0, host: "127.0.0.1" });
    io = attachRealtime(app.server, store);
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

  it("a client connects, joins by code, and receives synced state", async () => {
    const client = await connect();
    const joined = new Promise<{ playerId: string }>((resolve) => client.on("joined", resolve));
    const stateEvent = new Promise<{ state: SessionState }>((resolve) => client.on("state", resolve));

    client.emit("join", { code: session.code, nickname: "Al" });

    const { playerId } = await joined;
    const { state } = await stateEvent;

    expect(state.players[playerId]).toEqual({ nickname: "Al", isConnected: true });
    client.close();
  });

  it("broadcasts state to everyone in the session room on an event", async () => {
    const a = await connect();
    const b = await connect();
    await new Promise<void>((resolve) => {
      a.on("joined", () => resolve());
      a.emit("join", { code: session.code, nickname: "A" });
    });
    const sessionId = store.getByCode(session.code)!.id;
    await new Promise<void>((resolve) => {
      b.on("joined", () => resolve());
      b.emit("join", { code: session.code, nickname: "B" });
    });

    // B should receive a broadcast when A triggers an event (START moves phase to playing).
    const bSawPlaying = new Promise<SessionState>((resolve) => {
      b.on("state", ({ state }: { state: SessionState }) => {
        if (state.phase === "playing") {
          resolve(state);
        }
      });
    });
    a.emit("event", { sessionId, event: { type: "START" } });
    const state = await bSawPlaying;
    expect(state.phase).toBe("playing");

    a.close();
    b.close();
  });
});
