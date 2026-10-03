# Kuiz v1 — build plan

Status: **decided** (wayfinder ticket #11). The ordered, session-by-session build sequence
that ships the v1 slice, synthesized from the specs in `docs/spec/`. Each step is sized for a
single working session, with an outcome and a "done" check. This closes the wayfinder map;
implementation starts here.

**v1 slice (recap):** online + offline play; three Segment Types (Simple Quiz, Blind Test,
Themed A-Z) as templates; one scoring default (sum_points) + count_wins; nickname-only,
ephemeral sessions; template catalog in Postgres; responsive web (no native app).

**Legend:** 🔑 = needs something only you can provide.

---

## Phase 0 — Scaffold

**B1. Monorepo scaffold.** pnpm workspaces + Turborepo; TS config; Vitest; empty
`packages/core`, `packages/bricks`, `apps/web` (Vite+React), `apps/server` (Fastify).
*Done:* `pnpm build` and `pnpm test` run green across workspaces.

## Phase 1 — Core domain (`packages/core`)

**B2. Game-definition schema + validation.** Types for Game / Segment (group|leaf) /
LeafScoring / GroupScoring; runtime validation (Zod). *Done:* the spec's example Game parses
and validates; round-trips; unit tests. (spec: game-definition-schema)

**B3. Flow engine.** `SessionState`, `SessionEvent`, `reduceSession` with cursor traversal,
phases, delegation to a Brick-logic interface. *Done:* engine walks a tree of stub bricks via
events; tests. (spec: flow-execution-model)

**B4. Scoring.** Leaf scoring rules (binary/scaled/speedBonus), group aggregation
(sum_points, count_wins) via a strategy registry, tie-aware ranking, Scorecard. *Done:* unit
tests incl. ties. (spec: scoring-model)

## Phase 2 — Bricks (`packages/bricks`)

**B5. Brick contract + registry.** `BrickLogic` (init/reduce/isComplete/outcome, config-passed),
`BrickDefinition`, capabilities, shared `brickRegistry`; wire the engine to resolve via it.
*Done:* a stub brick registers and the engine drives it. (spec: brick-contract)

**B6. Question brick.** Answer types (single_select, free_text); answer checker
(exact/fuzzy). *Done:* reducer + outcome tests, including the prototype's fuzzy scenarios.

**B7. Presentational bricks.** display image, play sound/video (read-only, complete on
NEXT/timer). *Done:* tests; no outcome emitted.

## Phase 3 — Play locally (offline first) (`apps/web`)

**B8. Web shell + design foundation + view registry.** Vite+React app; **Tailwind + shadcn/ui;
CSS-variable token theme (light/dark)**; a small shared `ui/` kit (tokens + primitives);
`brickViews` map; web views for question + presentational bricks consuming shared tokens.
*Done:* a hardcoded one-segment quiz is playable in the browser, themed, Scorecard shows.
(spec: design-system, online-session)

**B9. Offline walkthrough.** Host view + GM controls (next/reveal/back) driving the engine
locally. *Done:* a template game is walked end-to-end offline. (spec: offline-runtime)

## Phase 4 — Online (`apps/server` + realtime)

**B10. Server + socket shell.** Fastify + Socket.IO; in-memory session store; runtime
orchestrator (dispatch events → `reduceSession` → broadcast); room per session. *Done:* a
client connects, joins, and sees state sync. (spec: online-session, research: realtime-stack)

**B11. Online lifecycle (open mode).** create → join (nickname) → lobby → play → results;
playerId in localStorage + reconnection. *Done:* two browser tabs play a quiz online; scores
update incrementally.

**B12. Per-viewer projection.** `project(session, viewer)`; players never see others'/
unrevealed answers; GM control view; bricks contribute hide rules. *Done:* player view hides
answers (verified); GM view fuller.

**B13. Private join mode.** GM roster + claim-a-slot. *Done:* a private session with
pre-created players, claim + reconnection work.

**B14. Server-authoritative + server-handler hook.** Input validated server-side; optional
async Brick `server` handler wired (stub). *Done:* client can't fake scores; handler hook
exercised with a stub.

## Phase 5 — Authoring, persistence, catalog

**B15. Postgres + catalog.** 🔑 a Postgres instance (local/hosted). ORM (Drizzle/Prisma);
`games` table; seed templates. *Done:* catalog query returns seeded templates.
(spec: persistence-model)

**B16. Authoring.** Template-first minimal composer: tree/list, add/remove/reorder,
schema-driven brick forms (+ custom override hook); save to localStorage. *Done:* create/edit
a game from a template and play it. (spec: authoring-model)

**B17. Catalog UI.** Browse templates → start a Session from one. *Done:* pick template →
create session → play (online or offline).

## Phase 6 — The three v1 Segment Types + ship

**B18. Simple Quiz + Themed A-Z templates.** Author both as Segment-Type templates from
existing bricks. *Done:* both playable end-to-end.

**B19. Blind Test.** 🔑 Spotify API key + app registration. The `spotify` brick (server
handler holds secrets); Blind Test template = `play music → question`. *Done:* Blind Test
playable. *If the key isn't ready, ship Blind Test first with a generic audio brick (upload/URL)
and add the Spotify brick when credentials arrive — no other step depends on it.*

**B20. Responsive polish + deploy.** 🔑 hosting choices. Mobile-web layout pass; deploy web +
server + DB. *Done:* deployed and playable on phones.

---

## Dependencies (critical path)

```
B1 → B2 → B3 → B4
         B3 → B5 → B6, B7
B5/B6/B7 → B8 → B9  (offline playable)
B8/B3 → B10 → B11 → B12 → B13 ; B10 → B14   (online playable)
B2 → B15 ; B5 → B16 → B17
B6/B7/B16 → B18 ; B19 (independent, needs 🔑) ; all → B20
```

**First playable milestones:** B8–B9 = a game played **offline** in the browser (no server, no
DB). B10–B11 = a game played **online** across two devices. Everything after deepens features.

## Out of this v1 build (design-for, later)

Native app; player accounts + API keys; MCP authoring server; visual flow-builder; published
player templates; manual offline scoring; conditional/branching flows; Redis multi-node.
All are non-precluded by the specs.
