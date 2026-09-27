# Flow execution model (v1)

Status: **decided** (wayfinder ticket #5). How a Session runs a Game: the engine walks the
Game's recursive Segment tree, drives each Brick's reducer, aggregates scores, and handles
who-advances + reconnection. Feeds #7 (online session), #8 (offline runtime), #14 (scoring).

See [`CONTEXT.md`](../../CONTEXT.md) and the schema/brick specs in this folder.

## Shape: the engine is a pure reducer too

Mirroring the Brick contract one level up, the whole Session is driven by a pure reducer over
plain-JSON state:

```ts
reduceSession(session: SessionState, event: SessionEvent): SessionState   // pure
```

`SessionState` is fully serializable — it *is* the value held in the realtime layer's
in-memory session store (see `docs/research/realtime-stack.md`), and a reconnecting player is
handed the current `SessionState` snapshot.

```ts
type Phase = "lobby" | "playing" | "results"

type SessionState = {
  gameId: string
  mode: "online" | "offline"
  phase: Phase
  players: Record<PlayerId, { nickname: string; connected: boolean }>
  cursor: SegmentId[] | null      // path root→current leaf Brick; null before start / after end
  brickState: unknown | null      // the current Brick's reducer state
  results: Record<SegmentId, SegmentResult>   // completed Segment Results
  scorecard: Scorecard            // live aggregate (online)
}

type SessionEvent =
  | { type: "START" }
  | { type: "PLAYER_JOINED"; playerId: string; nickname: string }
  | { type: "PLAYER_LEFT"; playerId: string }
  | { type: "PLAYER_INPUT"; playerId: string; input: unknown }  // → current Brick.reduce
  | { type: "TICK"; now: number }                               // → timers / timeout
  | { type: "SERVER_RESULT"; payload: unknown }                 // ← server handler → Brick.reduce
  | { type: "ADVANCE"; source: "auto" | "host" }
  | { type: "END" }
```

## Tree traversal (the cursor)

The Game is a recursive tree of Segments (groups + Brick leaves). The `cursor` is the path
from the root to the current leaf Brick.

- On `START`: phase → `playing`; descend from the root to the first leaf Brick (first child,
  recursing into groups); `brickState = brick.logic.init(config, ctx)`.
- Brick-level events (`PLAYER_INPUT`, `TICK`, `SERVER_RESULT`) are routed to the current
  Brick: `brickState = brick.logic.reduce(brickState, brickEvent)`.
- After each brick reduce, if `brick.logic.isComplete(brickState)`: read
  `brick.logic.outcome(brickState)`, fold it into `results` for the enclosing Segment and up
  into the `scorecard` (see Scoring), then wait for an `ADVANCE`.
- On `ADVANCE`: move the cursor to the **next leaf** — next sibling; if none, pop to the
  parent group's next sibling, recursing. When a group completes, its Segment Result is the
  aggregate of its children (ticket #14). When the cursor runs off the root: phase →
  `results`.

`children` run in array order in v1. Conditional routing (`entry`/`next`/`branches` from the
game-definition schema) plugs in here later without changing this loop — it only changes how
"the next Segment" is computed.

## Who advances (Q3)

Same reducer; the difference is **only what emits `ADVANCE`**:

- **Online**: `ADVANCE { source: "auto" }` is emitted when the current Brick is complete —
  **all connected players have answered, or the timer times out** — so play flows without
  waiting on the host. The host may also emit `ADVANCE { source: "host" }` (skip/next) or a
  pause as an override.
- **Offline** (single device, GM only): the GM emits `ADVANCE { source: "host" }` for every
  step. No player input, no scoring in v1 — the engine just presents each Brick and advances.

## Pure core, impure shell (Q4)

`reduceSession` and every Brick reducer are **pure**. A thin **runtime/orchestrator** (the
impure shell) does all I/O and feeds events back into the reducer:

- runs timers → dispatches `TICK`
- calls a Brick's `server` handler (Spotify fetch, AI answer-review) → dispatches
  `SERVER_RESULT`
- broadcasts `SessionState` (or diffs) to clients over WebSocket after each transition
- receives client input → dispatches `PLAYER_INPUT`

**Online** uses the server-side shell (authoritative; see the Brick contract's trust
boundary). **Offline** uses a trivial local shell on the single device — no broadcast, no
server handler calls beyond local ones, no scoring.

## Scoring (Q5)

Incremental. When a Brick/Segment completes, its outcome is folded into the enclosing
Segment Result and up into the live `scorecard` immediately — so online shows scores "after
each question". The `scorecard` is part of `SessionState` and broadcast on each change. The
exact fold/aggregation strategy is ticket #14.

## Reconnection

Because `SessionState` is fully serializable and the reducer is deterministic, reconnection is
just re-sending the current snapshot. No hidden engine state; all effects live in the shell.

## One engine, two modes

| | Online | Offline (v1) |
|---|---|---|
| Shell | server-authoritative, broadcasts | local, single device |
| `ADVANCE` source | auto (all-answered/timeout) + host override | host (GM) each step |
| Player input | yes | no |
| Scoring / Scorecard | yes, incremental | no (deferred) |
| Core reducer | identical | identical |
