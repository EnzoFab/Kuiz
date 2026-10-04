import { brickRegistry } from "@kuiz/bricks";
import { buildApp } from "./app.js";
import { SessionStore } from "./sessions.js";
import { attachRealtime } from "./realtime.js";
import { demoGame } from "./demo.js";

const port = Number(process.env.PORT ?? 3001);
const app = buildApp();
const store = new SessionStore(brickRegistry.resolver(), (type) =>
  brickRegistry.has(type) ? brickRegistry.get(type) : undefined,
);

app
  .listen({ port, host: "0.0.0.0" })
  .then(() => {
    attachRealtime(app.server, store, () => demoGame);
    console.log(`@kuiz/server listening on :${port}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
