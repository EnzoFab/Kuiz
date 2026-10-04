import Fastify, { type FastifyInstance } from "fastify";

/**
 * Builds the Fastify app. In later steps this hosts the Socket.IO runtime shell,
 * the in-memory session store, and Brick server handlers (see docs/spec/online-session.md).
 * B1 scaffold: just a health route, so the server builds and is testable without I/O setup.
 */
export function buildApp(): FastifyInstance {
  const app = Fastify();
  // Allow the web origin to read GET /catalog cross-origin (set CORS_ORIGIN in prod; "*" in
  // dev). Our routes are simple GETs, so no preflight handling is needed.
  app.addHook("onRequest", async (_req, reply) => {
    reply.header("Access-Control-Allow-Origin", process.env.CORS_ORIGIN ?? "*");
  });
  app.get("/health", async () => ({ status: "ok" }));
  return app;
}
