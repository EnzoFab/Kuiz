# Scoring & aggregation model (v1)

Status: **decided** (wayfinder ticket #14). How raw Brick facts become points, and how points
fold up the Segment tree into the Scorecard. Completes the runtime design. Feeds #11.

See `docs/spec/brick-contract.md`, `docs/spec/flow-execution-model.md`,
`docs/spec/game-definition-schema.md`.

## Principle

Bricks emit **facts** (`correct`, `matchScore`, `responseMs`); **Segments own scoring**.
Scoring is recursive: a **leaf** Segment turns its Brick's outcome into `{position, points}`;
a **group** Segment aggregates its children's `{position, points}`. The **Scorecard** is the
root Segment's result.

## Leaf Segment scoring (Q1)

Points and grading live on the **leaf Segment's `scoring` rule** — the Brick stays
facts-only.

> Correction to #12/#10: a question's point value lives in the enclosing **leaf Segment's
> scoring rule**, not in the Brick `config`. The Brick `config` holds content (prompt, answer,
> checker); the Segment decides what it's worth.

```ts
type LeafScoring = {
  basePoints: number
  grading: "binary" | "scaled"   // v1 default: "binary"
  speedBonus?: boolean           // optional; off by default
}
```

- **binary** (default): `correct ? basePoints : 0`.
- **scaled**: `round(basePoints × matchScore)` — partial credit for fuzzy near-misses.
- **speedBonus** (optional): a small bonus ranked by `responseMs`.

## Group Segment aggregation (Q2)

A group folds its children's Segment Results into its own, via a **pluggable strategy**
(a registry, mirroring the Brick registry — new rating types drop in without engine changes).

- **`sum_points`** (v1 default) — add each player's points across children.
- **`count_wins`** — count the child Segments where the player placed #1 ("A wins sub-game 1,
  B wins sub-game 2").
- *Later:* `best_positions`, `weighted`, custom.

```ts
type GroupScoring = { aggregation: "sum_points" | "count_wins" | string }
```

## Position & ties (Q3)

Within any Segment Result, **positions derive from the aggregated metric, tie-aware** — equal
scores **share** a position (two players both #2), as the prototype demonstrated. v1 applies
**no forced tiebreak** (players can be even on the Scorecard — a stated requirement). An
optional tiebreak (e.g. by speed) is a later knob.

## Types

```ts
type SegmentResult = { perPlayer: Record<PlayerId, { position: number; points: number }> }

type Scorecard = {
  perPlayer: Record<PlayerId, { position: number; points: number }>   // root result
  bySegment: Record<SegmentId, SegmentResult>                          // retained for UI breakdown
}
```

## Computation (recursive, incremental)

1. A **leaf** completes → `outcome(config, state)` → apply `LeafScoring` per player → rank
   tie-aware → `SegmentResult`.
2. A **group** completes (all children done) → apply its `GroupScoring.aggregation` across
   children's `SegmentResult`s → rank tie-aware → its own `SegmentResult`.
3. The **root** group's result **is** the Scorecard; `bySegment` retains each Segment's result
   for display.

Per #5, this runs **incrementally** — each completed Brick/Segment folds into the live
Scorecard immediately, which is part of `SessionState` and broadcast on change (online). Offline
has no scoring in v1.

## Where scoring config lives (schema)

Each Segment in the game-definition schema carries `scoring`: a `LeafScoring` on leaves, a
`GroupScoring` on groups. This is the `scoring?` field already present in
`docs/spec/game-definition-schema.md`.
