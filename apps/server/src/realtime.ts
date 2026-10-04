import type { Server as HttpServer } from "node:http";
import { randomUUID } from "node:crypto";
import { Server as IOServer, type Socket } from "socket.io";
import { safeParseGame, type Game, type SessionEvent } from "@kuiz/core";
import type { SessionStore } from "./sessions.js";
import { projectGame, projectState } from "./projection.js";
import { authorizeClientEvent } from "./authorize.js";

/**
 * The realtime runtime shell: Socket.IO over the HTTP server, one Room per Session. Client
 * messages become SessionEvents dispatched through the pure engine; the new state is
 * broadcast to the room. Open-mode lifecycle (B11): create → join (+ reconnect) → event →
 * disconnect. Per-viewer projection (B12) and server-authoritative validation (B14) build on
 * this. See docs/spec/online-session.md.
 */

interface CreatePayload {
  nickname: string;
  /** Private mode: pre-created player names. Open mode when empty/absent. */
  roster?: string[];
  /** The Game to host (from the catalog, B17). Validated server-side; falls back to the demo. */
  game?: unknown;
}
interface JoinPayload {
  code: string;
  nickname: string;
  playerId?: string; // for reconnection
}
interface WatchPayload {
  code: string;
}
interface ClaimPayload {
  playerSlotId: string;
}
interface JoinResult {
  sessionId?: string;
  code?: string;
  playerId?: string;
  hostId?: string;
  game?: Game;
  joinMode?: "open" | "private";
  error?: string;
}
type Ack = (result: JoinResult) => void;

export function attachRealtime(httpServer: HttpServer, store: SessionStore, gameFor: () => Game): IOServer {
  // CORS origin is configurable for production (set CORS_ORIGIN to the web origin); "*" in dev.
  const io = new IOServer(httpServer, { cors: { origin: process.env.CORS_ORIGIN ?? "*" } });

  // Broadcast a per-viewer projected state to every socket in the session room (B12).
  const broadcast = async (sessionId: string): Promise<void> => {
    const session = store.get(sessionId);
    if (!session) {
      return;
    }
    const sockets = await io.in(sessionId).fetchSockets();
    for (const s of sockets) {
      const viewerId = (s.data as { playerId?: string }).playerId ?? "";
      const isHost = viewerId === session.hostId;
      const view = projectState(session.game, session.state, viewerId, isHost);
      s.emit("state", { state: view.state, revealedAnswer: view.revealedAnswer });
    }
  };

  io.on("connection", (socket: Socket) => {
    let context: { sessionId: string; playerId?: string } | null = null;

    socket.on("create", async ({ nickname, roster, game }: CreatePayload, ack?: Ack) => {
      const isPrivate = Array.isArray(roster) && roster.length > 0;
      // The host may supply a Game to host; validate it server-side (never trust the client).
      const parsed = game != null ? safeParseGame(game) : null;
      const chosenGame = parsed?.success ? parsed.data : gameFor();
      const session = store.create(chosenGame, "online", isPrivate ? "private" : "open");
      const playerId = randomUUID();
      session.hostId = playerId;
      socket.data.playerId = playerId;
      socket.join(session.id);
      store.apply(session.id, { type: "PLAYER_JOINED", playerId, nickname });
      if (isPrivate) {
        for (const name of roster) {
          store.apply(session.id, { type: "ADD_SLOT", playerId: randomUUID(), nickname: name });
        }
      }
      context = { sessionId: session.id, playerId };
      ack?.({
        sessionId: session.id,
        code: session.code,
        playerId,
        hostId: playerId,
        game: projectGame(session.game, true),
        joinMode: session.state.joinMode,
      });
      await broadcast(session.id);
    });

    socket.on("join", async ({ code, nickname, playerId: existing }: JoinPayload, ack?: Ack) => {
      const session = store.getByCode(code);
      if (!session) {
        ack?.({ error: "Session not found" });
        return;
      }
      // Reconnect if the playerId is already known; otherwise a fresh player.
      const isReconnect = existing != null && session.state.players[existing] != null;
      const playerId = isReconnect ? existing! : randomUUID();
      const isHost = playerId === session.hostId;
      socket.data.playerId = playerId;
      socket.join(session.id);
      store.apply(session.id, { type: "PLAYER_JOINED", playerId, nickname });
      context = { sessionId: session.id, playerId };
      ack?.({
        sessionId: session.id,
        code: session.code,
        playerId,
        hostId: session.hostId,
        game: projectGame(session.game, isHost),
        joinMode: session.state.joinMode,
      });
      await broadcast(session.id);
    });

    // Private mode: connect to watch (receive the roster) before claiming a slot.
    socket.on("watch", async ({ code }: WatchPayload, ack?: Ack) => {
      const session = store.getByCode(code);
      if (!session) {
        ack?.({ error: "Session not found" });
        return;
      }
      socket.join(session.id);
      context = { sessionId: session.id };
      ack?.({
        sessionId: session.id,
        code: session.code,
        hostId: session.hostId,
        game: projectGame(session.game, false),
        joinMode: session.state.joinMode,
      });
      await broadcast(session.id);
    });

    // Private mode: claim a roster slot (also reconnects to a previously claimed slot).
    socket.on("claim", async ({ playerSlotId }: ClaimPayload, ack?: Ack) => {
      if (!context) {
        ack?.({ error: "Not in a session" });
        return;
      }
      const session = store.get(context.sessionId);
      if (!session || !session.state.players[playerSlotId]) {
        ack?.({ error: "Slot not found" });
        return;
      }
      store.apply(context.sessionId, { type: "CLAIM", playerId: playerSlotId });
      context = { ...context, playerId: playerSlotId };
      socket.data.playerId = playerSlotId;
      ack?.({
        sessionId: context.sessionId,
        code: session.code,
        playerId: playerSlotId,
        hostId: session.hostId,
        game: projectGame(session.game, false),
        joinMode: session.state.joinMode,
      });
      await broadcast(context.sessionId);
    });

    socket.on("event", async ({ event }: { event: SessionEvent }) => {
      if (!context) {
        return;
      }
      const session = store.get(context.sessionId);
      if (!session) {
        return;
      }
      // Trust boundary: normalize/reject before applying — the client can't fake identity,
      // timing, or host-only flow control (B14).
      const authorized = authorizeClientEvent(event, {
        playerId: context.playerId,
        isHost: context.playerId === session.hostId,
        now: Date.now(),
      });
      if (!authorized) {
        return;
      }
      store.apply(context.sessionId, authorized);
      await store.runServerHandler(context.sessionId);
      await broadcast(context.sessionId);
    });

    socket.on("disconnect", async () => {
      if (!context?.playerId) {
        return;
      }
      store.apply(context.sessionId, { type: "PLAYER_LEFT", playerId: context.playerId });
      await broadcast(context.sessionId);
    });
  });

  return io;
}
