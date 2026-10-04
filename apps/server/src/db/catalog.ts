import type { Game } from "@kuiz/core";
import { Prisma } from "../generated/prisma/client.js";
import type { Db } from "./client.js";

/**
 * Catalog queries (B15). The v1 catalog is the `games` rows with `visibility = 'template'`.
 * See docs/spec/persistence-model.md.
 */

export interface CatalogEntry {
  id: string;
  title: string;
  json: Game;
}

/** Upsert the given Games as templates. Idempotent — re-seeding overwrites by id. */
export async function seedTemplates(db: Db, templates: Game[]): Promise<void> {
  for (const game of templates) {
    const json = game as unknown as Prisma.InputJsonValue;
    await db.game.upsert({
      where: { id: game.id },
      create: { id: game.id, json, title: game.title, visibility: "template" },
      update: { json, title: game.title },
    });
  }
}

/** The catalog: every template Game, for listing. */
export async function listTemplates(db: Db): Promise<CatalogEntry[]> {
  const rows = await db.game.findMany({
    where: { visibility: "template" },
    select: { id: true, title: true, json: true },
  });
  return rows.map((row) => ({ id: row.id, title: row.title, json: row.json as unknown as Game }));
}
