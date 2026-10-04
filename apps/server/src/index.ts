import { brickRegistry } from "@kuiz/bricks";
import { buildApp } from "./app.js";
import { SessionStore } from "./sessions.js";
import { attachRealtime } from "./realtime.js";
import { registerCatalogRoutes } from "./catalog-routes.js";
import { createPostgresClient, ensureSchema, seedTemplates } from "./db/index.js";
import { demoGame } from "./demo.js";

const port = Number(process.env.PORT ?? 3001);
const app = buildApp();
const store = new SessionStore(brickRegistry.resolver(), (type) =>
  brickRegistry.has(type) ? brickRegistry.get(type) : undefined,
);

// Catalog needs Postgres; without DATABASE_URL the server still runs the realtime demo path.
const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl) {
  const db = createPostgresClient(databaseUrl);
  await ensureSchema(db);
  await seedTemplates(db, [demoGame]);
  registerCatalogRoutes(app, db);
}

app
  .listen({ port, host: "0.0.0.0" })
  .then(() => {
    attachRealtime(app.server, store, () => demoGame);
    console.log(`@kuiz/server listening on :${port}${databaseUrl ? " (catalog enabled)" : ""}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
