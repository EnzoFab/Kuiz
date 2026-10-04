import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

/**
 * The persistence client (B15). Prisma 7 talks to Postgres through a driver adapter:
 * `@prisma/adapter-pg` in prod/staging, pglite in tests (see the test files). The Game
 * document is a JSON column (source of truth); see docs/spec/persistence-model.md and
 * prisma/schema.prisma.
 */

export type Db = PrismaClient;
export type Visibility = "template" | "private" | "published";

/** Connect to a real Postgres via DATABASE_URL (deploy/staging). */
export function createPostgresClient(connectionString: string): Db {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/**
 * The one table's DDL. One table → `CREATE TABLE IF NOT EXISTS` bootstraps the schema for
 * tests and first boot; once a Postgres is provisioned, `prisma migrate deploy` owns it and
 * this becomes a no-op. ponytail: raw DDL until the dataset grows enough to need migrations.
 */
export const SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS games (
  id          text PRIMARY KEY,
  json        jsonb NOT NULL,
  title       text NOT NULL,
  visibility  text NOT NULL,
  owner_id    text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
`;

export async function ensureSchema(db: Db): Promise<void> {
  await db.$executeRawUnsafe(SCHEMA_DDL);
}
