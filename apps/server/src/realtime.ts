import type { Server as HttpServer } from "node:http";
import { randomUUID } from "node:crypto";
import { Server as IOServer, type Socket } from "socket.io";
import type { SessionEvent } from "@kuiz/core";
import type { SessionStore } from "./sessions.js";

/**
 * The realtime runtime shell (B10): wires Socket.IO over the HTTP server. One Room per
 * Session. Client messages become SessionEvents dispatched through the pure engine; the new
 * state is broadcast to the room. Per-viewer projection (B12), full lifecycle (B11), and
 * server-authoritative validation (B14) build on this.
 */
export function attachRealtime(httpServer: HttpServer, store: SessionStore): IOServer {
  const io = new IOServer(httpServer, { cors: { origin: "*" } });

  io.on("connection", (socket: Socket) => {
    socket.on("join", ({ code, nickname }: { code: string; nickname: string }) => {
      const session = store.getByCode(code);
      if (!session) {
        socket.emit("error_msg", { message: "Session not found" });
        return;
      }
      const playerId = randomUUID();
      socket.join(session.id);
      store.apply(session.id, { type: "PLAYER_JOINED", playerId, nickname });
      socket.emit("joined", { playerId, sessionId: session.id });
      io.to(session.id).emit("state", { state: store.get(session.id)?.state });
    });

    socket.on("event", ({ sessionId, event }: { sessionId: string; event: SessionEvent }) => {
      const session = store.apply(sessionId, event);
      if (session) {
        io.to(sessionId).emit("state", { state: session.state });
      }
    });
  });

  return io;
}
