# Persistence model (v1)

Status: **decided** (wayfinder ticket #9). What is stored, where, and for how long. Feeds #11
(build plan).

See [`CONTEXT.md`](../../CONTEXT.md) and `docs/spec/game-definition-schema.md`,
`docs/spec/online-session.md`, `docs/research/realtime-stack.md`.

## What persists (v1 matrix)

| Data | v1 storage |
|---|---|
| **Templates** (owner-authored Games) | **DB catalog** (seeded) |
| **Anonymous in-progress authoring** | **localStorage** |
| **Live session state** | **in-memory** (ephemeral; dies on session end) |
| **Results / scorecard history** | **not stored** (ephemeral) |
| **Logged-in GM's saved Games** | *deferred* (needs accounts) |

v1 writes almost nothing durable except the template catalog; everything play-related is
ephemeral.

## Database

- **Postgres** with a **JSONB** column holding the Game document, via a TypeScript ORM
  (Drizzle or Prisma — decide at build time).
- Stores the Game doc as-is **and** carries relational structure for ownership/accounts later,
  so no DB swap when accounts land.

### `games` table

```
games(
  id          text primary key,
  json        jsonb,                                  -- the Game document (source of truth)
  title       text,                                   -- extracted for listing
  visibility  text,  -- "template" | "private" | "published"
  owner_id    text null,                              -- nullable; for future accounts
  created_at  timestamptz,
  updated_at  timestamptz
)
```

- The `json` column is the **source of truth**; `title`, `visibility`, `owner_id` are
  extracted/duplicated for querying and listing.
- **Catalog** (v1) = `games where visibility = 'template'`.

## Session store

Live `SessionState` (#5) lives in an **in-memory `Map<sessionId, SessionState>`** on the
server — ephemeral, discarded when the session ends. Scale path (later): move session state
into **Redis** and add the Socket.IO Redis adapter for multi-node (per
`docs/research/realtime-stack.md`). Not needed for single-node v1.

## Deferred (schema-ready)

Accounts, logged-in GM saved Games, API keys, MCP writes, published player templates, and
results history are all deferred. `owner_id` + `visibility` are already in the schema, so:
- a logged-in GM's save → `visibility: "private"`, `owner_id` set;
- a player-published template → `visibility: "published"`;
- MCP writes → authenticated by API key, same `games` table.

No reshape required when these land.
