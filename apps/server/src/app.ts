import Fastify, { type FastifyInstance } from "fastify";

/**
 * Builds the Fastify app. In later steps this hosts the Socket.IO runtime shell,
 * the in-memory session store, and Brick server handlers (see docs/spec/online-session.md).
 * B1 scaffold: just a health route, so the server builds and is testable without I/O setup.
 */
export function buildApp(): FastifyInstance {
  const app = Fastify();
  app.get("/health", async () => ({ status: "ok" }));
  return app;
}
