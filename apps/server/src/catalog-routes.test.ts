import { describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { PrismaPGlite } from "pglite-prisma-adapter";
import { buildApp } from "./app.js";
import { registerCatalogRoutes } from "./catalog-routes.js";
import { PrismaClient } from "./generated/prisma/client.js";
import { ensureSchema } from "./db/client.js";
import { seedTemplates } from "./db/catalog.js";
import { demoGame } from "./demo.js";

describe("GET /catalog", () => {
  it("serves the seeded templates", async () => {
    const db = new PrismaClient({ adapter: new PrismaPGlite(new PGlite()) });
    await ensureSchema(db);
    await seedTemplates(db, [demoGame]);

    const app = buildApp();
    registerCatalogRoutes(app, db);
    const res = await app.inject({ method: "GET", url: "/catalog" });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { templates: { id: string; title: string }[] };
    expect(body.templates).toEqual([{ id: demoGame.id, title: demoGame.title, json: demoGame }]);
  });
});
