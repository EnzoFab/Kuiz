# Brick contract (v1)

Status: **decided** (wayfinder ticket #13). This is the extensibility seam: adding a new
Brick is the only change that requires code, and every Brick is driven by the flow engine
through one small, uniform interface. Feeds #14 (scoring), #6 (authoring), #5 (flow
execution), and the deferred MCP authoring server.

See [`CONTEXT.md`](../../CONTEXT.md) for terms (Brick, Segment, Segment Result, Scorecard).

## Design goal

A Brick is a **deep module**: a lot of behaviour (a quiz round, a Spotify integration)
behind a **small interface** the engine drives identically for every Brick. The engine only
ever knows the interface below; it never knows "question" from "blind test". Add a Brick →
the engine is unchanged.

## Layers and where they live

| Layer | Home | Consumers |
|---|---|---|
| **Contract** — machine-readable config schema + State/Event/Outcome types + capabilities | shared package (`@kuiz/core`, pure TS) | web, native, backend, MCP |
| **Logic** — `init` / `reduce` / `isComplete` / `outcome` (pure) | shared package | clients (optimistic) + server (authoritative) |
| **Server handler** — optional, impure (effects/secrets/AI) | backend | engine, when a Brick needs it |
| **View** — authoring form + play/display UI | per-frontend (web now, native later) | that client only |

Registration: one **contract+logic registry** (`brickRegistry`, shared, backend-reachable)
+ a per-client **view map** (`brickViews`). A Game's `brick.type` resolves the same logic
everywhere; each client supplies its own views.

## The runtime interface (the seam)

```ts
type BrickCapabilities = {
  interactive: boolean            // collects player input and emits an outcome
  scoring: boolean                // its outcome contributes to Segment scoring
  needsServer: boolean            // requires the server handler (effects/secrets/AI)
  modes: ("online" | "offline")[] // session modes it supports
}

// Pure, platform-agnostic. State/Event/Outcome are plain JSON.
type BrickLogic<Config, State, Event, Outcome> = {
  init(config: Config, ctx: BrickContext): State             // starting state when the Brick begins
  reduce(config: Config, state: State, event: Event): State  // (input | host action | tick) → new state; pure
  isComplete(state: State): boolean                          // true at the Brick's terminal state
  outcome(config: Config, state: State): Outcome | null      // per-player raw facts; null for presentational
}
```

> **Prototype findings (#10), folded in:**
> 1. `reduce` and `outcome` **take `config`** — the config holds the answer and the answer-checker, so the engine passes the current Brick's config into every logic call (not just `init`).
> 2. `isComplete` is the Brick's **terminal state**; there is no separate "complete" step after "revealed". A question is complete **once its answer is revealed** (triggered by all-answered/timeout online, or the GM offline); `ADVANCE` then moves the cursor.

```ts
// (BrickServerHandler / BrickDefinition / BrickView unchanged below)

// Optional: effects the pure reducer can't do; result re-enters reduce() as an event.
type BrickServerHandler<Config, Event> = {
  resolve(config: Config, req: ServerRequest): Promise<Event>
}

// The module bundle registered per Brick type (shared side):
type BrickDefinition<Config, State, Event, Outcome> = {
  type: string
  configSchema: JsonSchema                         // machine-readable → form + MCP + runtime validation
  capabilities: BrickCapabilities
  logic: BrickLogic<Config, State, Event, Outcome>
  server?: BrickServerHandler<Config, Event>       // present iff capabilities.needsServer
}

// Per client:
type BrickView<Config, State> = {
  Authoring: Component<{ config: Config; onChange(c: Config): void }>
  Play: Component<{ config: Config; state: State; onEvent(e: unknown): void }>
}
```

### Why this shape
- **Pure reducer** → state is serializable (fits the in-memory session store + reconnection),
  the same `reduce` runs authoritatively on the server and optimistically on the client, and a
  Brick is tested by feeding events and asserting state — no mocks.
- **Small interface** → the engine learns 4 functions and drives every Brick; extensibility
  cost is one folder per new Brick.

## Kinds of Brick

- **Presentational** (read-only): `display image`, `play sound`, `play music/video`.
  `interactive: false, scoring: false`; emit **no outcome**; complete on a `NEXT` event
  (fired by a timer if config has a duration, or by the host/player).
- **Interactive**: `question` (with answer types). Collect input, emit per-player outcomes.

"What's this music?" is a Segment `[ play music (presentational) → question (interactive) ]`
— not a media Brick that also asks. Single responsibility keeps Bricks composable.

## Outcome → scoring boundary

A Brick emits **raw per-player facts**; the **Segment** turns facts into `{ position, points }`
(that mapping is ticket #14). Example question outcome:

```ts
type QuestionOutcome = {
  perPlayer: Record<PlayerId, {
    answer: string
    correct: boolean
    matchScore: number    // 0..1, for graded/fuzzy checks
    responseMs: number
  }>
}
```

**Pluggable answer checker** (on the question Brick): `exact` and `fuzzy` (e.g. Levenshtein —
"spelling shouldn't be super punitive") are **pure**, computed in `reduce`/`outcome`; `ai`
(semantic "close enough") is **impure** and runs via the `server` handler, its verdict
returning as an event.

## Execution & trust boundary

- **Online**: the server runs `reduce` **authoritatively** — it owns state, applies events,
  broadcasts state to clients; clients render via views and send player input as events, and
  may run `reduce` optimistically for instant feedback. Clients cannot fake scores.
- **Offline** (single device, GM only): the same `reduce` runs locally; no server, no scoring.
- The **server handler** is awaited by the engine (e.g. fetch a Spotify track, run an AI
  review); its result is fed into `reduce` as an event, keeping the reducer pure.

## Adding a new Brick (the extensibility promise)

1. Add `contract.ts` (config schema + types + capabilities) and `logic.ts` to the shared
   package; register in `brickRegistry`.
2. Add `view.web.tsx` (later `view.native.tsx`) in each client; register in `brickViews`.
3. Add `server.ts` only if `needsServer`.

No engine change. New sub-games/games remain pure composition (no code).
