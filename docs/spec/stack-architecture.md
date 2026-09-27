# Repository & stack architecture (v1)

Status: **decided** (wayfinder ticket #4). The monorepo skeleton and stack that let web,
server, and a later native app share the game-definition schema, engine, and Brick
contract+logic. Feeds #11 (build plan).

## Stack

- **Language:** TypeScript everywhere.
- **Monorepo:** **pnpm workspaces + Turborepo** (pnpm for linking, Turbo for cached
  build/test/lint task running).
- **Web client:** **Vite + React** (SPA) — lean, realtime-friendly; no SSR/SEO needed in v1.
- **Backend:** **Fastify + Socket.IO** — a thin shell (WebSocket, session store, Brick server
  handlers); most logic is pure and lives in `core`/`bricks`.
- **Realtime:** Socket.IO (Rooms = Sessions), per `docs/research/realtime-stack.md`.
- **Testing:** **Vitest** across packages — pure reducers (engine + bricks) test by feeding
  events, no mocks.
- **Mobile (later):** React Native app added as `apps/mobile`, reusing `core` + `bricks`,
  adding native Brick views.

## Layout

```
packages/
  core/        # game-definition schema types, engine reducer (reduceSession),
               # session types, Brick contract interfaces. Pure. No UI, no I/O.
  bricks/      # each Brick's contract + logic (init/reduce/isComplete/outcome) + the
               # shared brickRegistry. Pure, backend-reachable. No views.
apps/
  web/         # React client (Vite): Brick *views* + view map, gameplay + authoring UI,
               # Socket.IO client
  server/      # Fastify + Socket.IO: runtime/orchestrator shell (timers, broadcast,
               # Brick server handlers), in-memory session store
  # mobile/    # React Native (later): native Brick views + view map
```

## Dependency direction

```
core  ←  bricks  ←  apps/web
core  ←  bricks  ←  apps/server
                 ←  apps/mobile (later)
```

- `core` depends on nothing internal; `bricks` depends only on `core`; apps depend on both.
- **No app is a dependency of a package.** Views never leak into `core`/`bricks`.
- The **contract+logic registry** (`brickRegistry`) lives in `packages/bricks` (shared,
  imported by server for authoritative logic + MCP later). Each app owns its **view map**
  (`brickViews`) mapping `brick.type → platform view`.

## Why this shape

- Matches the Brick layering (contract/logic shared; views per-frontend) and the pure
  engine — the two things that must be reused identically across client, server, and MCP live
  in `core`/`bricks`; everything platform-specific is an app.
- The server stays a thin impure shell around pure cores → small, testable surface.
- Adding a Brick = a folder in `packages/bricks` (+ `core` types if new) and a view per app —
  no cross-cutting changes.

## Build threshold

With #12 (schema), #13 (brick contract), #5 (flow execution) and this ticket decided, the
core is fully specified: the monorepo can be scaffolded and a vertical slice built —
`core` + `bricks` (one brick) + engine + a minimal `apps/web` playing a one-brick game — even
before the full build plan (#11) is written.
