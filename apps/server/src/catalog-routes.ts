import type { FastifyInstance } from "fastify";
import { listTemplates, type Db } from "./db/index.js";

/** `GET /catalog` → the seeded template Games. Wired only when a DB is configured. */
export function registerCatalogRoutes(app: FastifyInstance, db: Db): void {
  app.get("/catalog", async () => ({ templates: await listTemplates(db) }));
}
