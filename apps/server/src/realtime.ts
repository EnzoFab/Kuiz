import type { Server as HttpServer } from "node:http";
import { randomUUID } from "node:crypto";
import { Server as IOServer, type Socket } from "socket.io";
import type { Game, SessionEvent } from "@kuiz/core";
import type { SessionStore } from "./sessions.js";
import { projectGame, projectState } from "./projection.js";

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
    let context: { sessionId: string; playerId: string } | null = null;

    socket.on("create", async ({ nickname }: CreatePayload, ack?: Ack) => {
      const session = store.create(gameFor());
      const playerId = randomUUID();
      session.hostId = playerId;
      socket.data.playerId = playerId;
      socket.join(session.id);
      store.apply(session.id, { type: "PLAYER_JOINED", playerId, nickname });
      context = { sessionId: session.id, playerId };
      ack?.({
        sessionId: session.id,
        code: session.code,
        playerId,
        hostId: playerId,
        game: projectGame(session.game, true),
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
      });
      await broadcast(session.id);
    });

    socket.on("event", async ({ event }: { event: SessionEvent }) => {
      if (!context) {
        return;
      }
      store.apply(context.sessionId, event);
      await broadcast(context.sessionId);
    });

    socket.on("disconnect", async () => {
      if (!context) {
        return;
      }
      store.apply(context.sessionId, { type: "PLAYER_LEFT", playerId: context.playerId });
      await broadcast(context.sessionId);
    });
  });

  return io;
}
