import type { Server as HttpServer } from "node:http";
import { randomUUID } from "node:crypto";
import { Server as IOServer, type Socket } from "socket.io";
import type { Game, SessionEvent } from "@kuiz/core";
import type { SessionStore } from "./sessions.js";

/**
 * The realtime runtime shell: Socket.IO over the HTTP server, one Room per Session. Client
 * messages become SessionEvents dispatched through the pure engine; the new state is
 * broadcast to the room. Open-mode lifecycle (B11): create → join (+ reconnect) → event →
 * disconnect. Per-viewer projection (B12) and server-authoritative validation (B14) build on
 * this. See docs/spec/online-session.md.
 */

interface CreatePayload {
  nickname: string;
}
interface JoinPayload {
  code: string;
  nickname: string;
  playerId?: string; // for reconnection
}
interface JoinResult {
  sessionId?: string;
  code?: string;
  playerId?: string;
  hostId?: string;
  game?: Game;
  error?: string;
}
type Ack = (result: JoinResult) => void;

export function attachRealtime(httpServer: HttpServer, store: SessionStore, gameFor: () => Game): IOServer {
  const io = new IOServer(httpServer, { cors: { origin: "*" } });

  io.on("connection", (socket: Socket) => {
    let context: { sessionId: string; playerId: string } | null = null;

    const broadcast = (sessionId: string): void => {
      const session = store.get(sessionId);
      if (session) {
        io.to(sessionId).emit("state", { state: session.state });
      }
    };

    socket.on("create", ({ nickname }: CreatePayload, ack?: Ack) => {
      const session = store.create(gameFor());
      const playerId = randomUUID();
      session.hostId = playerId;
      socket.join(session.id);
      store.apply(session.id, { type: "PLAYER_JOINED", playerId, nickname });
      context = { sessionId: session.id, playerId };
      ack?.({ sessionId: session.id, code: session.code, playerId, hostId: playerId, game: session.game });
      broadcast(session.id);
    });

    socket.on("join", ({ code, nickname, playerId: existing }: JoinPayload, ack?: Ack) => {
      const session = store.getByCode(code);
      if (!session) {
        ack?.({ error: "Session not found" });
        return;
      }
      // Reconnect if the playerId is already known; otherwise a fresh player.
      const isReconnect = existing != null && session.state.players[existing] != null;
      const playerId = isReconnect ? existing! : randomUUID();
      socket.join(session.id);
      store.apply(session.id, { type: "PLAYER_JOINED", playerId, nickname });
      context = { sessionId: session.id, playerId };
      ack?.({
        sessionId: session.id,
        code: session.code,
        playerId,
        hostId: session.hostId,
        game: session.game,
      });
      broadcast(session.id);
    });

    socket.on("event", ({ event }: { event: SessionEvent }) => {
      if (!context) {
        return;
      }
      store.apply(context.sessionId, event);
      broadcast(context.sessionId);
    });

    socket.on("disconnect", () => {
      if (!context) {
        return;
      }
      store.apply(context.sessionId, { type: "PLAYER_LEFT", playerId: context.playerId });
      broadcast(context.sessionId);
    });
  });

  return io;
}
