import { io, type Socket } from "socket.io-client";

/** The Kuiz realtime server URL (override with VITE_SERVER_URL). */
export const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3001";

export function connectSocket(): Socket {
  return io(SERVER_URL, { transports: ["websocket"] });
}
