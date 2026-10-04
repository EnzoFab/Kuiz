import { describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { PrismaPGlite } from "pglite-prisma-adapter";
import { PrismaClient } from "../generated/prisma/client.js";
import { ensureSchema, type Db } from "./client.js";
import { seedTemplates, listTemplates } from "./catalog.js";
import { demoGame } from "../demo.js";

/** A throwaway in-process Postgres (pglite) behind Prisma — real PG, no external instance. */
async function freshDb(): Promise<Db> {
  const db = new PrismaClient({ adapter: new PrismaPGlite(new PGlite()) });
  await ensureSchema(db);
  return db;
}

describe("catalog", () => {
  it("returns seeded templates", async () => {
    const db = await freshDb();
    await seedTemplates(db, [demoGame]);

    const templates = await listTemplates(db);
    expect(templates).toHaveLength(1);
    expect(templates[0]).toMatchObject({ id: demoGame.id, title: demoGame.title });
    expect(templates[0].json.root.kind).toBe("group"); // the Game doc round-trips through JSONB
  });

  it("re-seeding is idempotent (upsert by id)", async () => {
    const db = await freshDb();
    await seedTemplates(db, [demoGame]);
    await seedTemplates(db, [{ ...demoGame, title: "Renamed" }]);

    const templates = await listTemplates(db);
    expect(templates).toHaveLength(1);
    expect(templates[0].title).toBe("Renamed");
  });

  it("excludes non-template rows from the catalog", async () => {
    const db = await freshDb();
    await seedTemplates(db, [demoGame]);
    // A private game must not surface in the catalog.
    await db.game.create({
      data: { id: "p1", json: demoGame as object, title: "Private", visibility: "private" },
    });

    const templates = await listTemplates(db);
    expect(templates.map((t) => t.id)).toEqual([demoGame.id]);
  });
});
