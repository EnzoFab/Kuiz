# Deploying Kuiz (v1)

Platform-agnostic guide. Three pieces: a **Postgres** database, the **server** (`@kuiz/server`
— Fastify + Socket.IO, a long-running Node process; **not** serverless, it holds WebSocket
connections and in-memory session state), and the **web** app (`@kuiz/web` — a static Vite SPA
that can be hosted anywhere). Environment variables are documented in [`.env.example`](../.env.example).

## 1. Postgres

Provision a Postgres instance (any host: a managed service, a container, etc.) and get its
connection string → this is `DATABASE_URL`.

The server **creates its one table on boot** (`CREATE TABLE IF NOT EXISTS`, see
`apps/server/src/db/client.ts`) and seeds the demo template, so no migration step is required
for v1. When the schema grows, switch to managed migrations with Prisma:

```bash
pnpm --filter @kuiz/server exec prisma migrate deploy   # once a migration exists
```

> Without `DATABASE_URL` the server still runs (realtime play works); only the DB-backed
> catalog (`GET /catalog`) is disabled.

## 2. Server (Docker)

Build from the **repo root** (the image needs the workspace packages):

```bash
docker build -f apps/server/Dockerfile -t kuiz-server .
docker run -p 3001:3001 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/kuiz" \
  -e CORS_ORIGIN="https://your-web-domain" \
  kuiz-server
```

- `PORT` — defaults to 3001; the container listens on `0.0.0.0`.
- `CORS_ORIGIN` — set to the web app's origin so the browser can open the Socket.IO connection
  and read `GET /catalog`. Defaults to `*` (fine for local, lock it down in production).
- Health check: `GET /health` → `{ "status": "ok" }` (the image declares a `HEALTHCHECK`).

Any container host works (a PaaS that runs Dockerfiles, a VM with Docker, etc.). The process
holds session state in memory, so run **a single instance** for v1 — horizontal scaling needs
the Redis adapter (deferred, see `docs/research/realtime-stack.md`).

## 3. Web (static)

Build with the server URL baked in (Vite inlines `VITE_*` at build time):

```bash
VITE_SERVER_URL="https://your-server-domain" pnpm --filter @kuiz/web build
# → apps/web/dist/  (static files)
```

Deploy `apps/web/dist/` to any static host (a CDN, object storage + CDN, nginx, or a static-site
platform). Then set the server's `CORS_ORIGIN` to this site's origin.

## 4. Verify

1. Open the web URL on a laptop → **Browse catalog** → **Host online** a template → note the code.
2. On a phone, open the web URL → **Play online** → join with the code.
3. Host starts; answer on the phone; scores update. 🎉

## Notes / deferred

- **Single server instance** (in-memory sessions). Multi-node = Redis adapter + session store
  (deferred).
- **Image size**: the Dockerfile copies the whole workspace for simplicity; add a prune stage
  if size matters (see the comment in `apps/server/Dockerfile`).
- **Same-origin option**: you can instead serve `apps/web/dist` from the server (e.g. via a
  static-file plugin) to avoid CORS entirely — not wired in v1.
