import { brickRegistry } from "@kuiz/bricks";
import { buildApp } from "./app.js";
import { SessionStore } from "./sessions.js";
import { attachRealtime } from "./realtime.js";
import { demoGame } from "./demo.js";

const port = Number(process.env.PORT ?? 3001);
const app = buildApp();
const store = new SessionStore(brickRegistry.resolver());

// Seed a demo session so there is something to join before the catalog exists (B15/B17).
const demo = store.create(demoGame);

app
  .listen({ port, host: "0.0.0.0" })
  .then(() => {
    attachRealtime(app.server, store);
    console.log(`@kuiz/server listening on :${port}`);
    console.log(`demo session join code: ${demo.code}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
