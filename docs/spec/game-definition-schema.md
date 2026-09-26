# Game-definition schema (v1)

Status: **decided** (wayfinder ticket #12). Feeds #13 (Brick contract), #5 (flow
execution), #9 (persistence), #14 (scoring).

A **Game** is a self-contained, portable JSON document describing a composition of Bricks.
It is storage-agnostic (localStorage now; a DB catalog for templates and logged-in users'
reusable games later — see #11) and designed to be authored/edited by an MCP tool or an LLM
as plain JSON, with no compiler or DSL step.

See [`CONTEXT.md`](../../CONTEXT.md) for the domain terms (Brick, Segment, Segment Type,
Game, Flow, Segment Result, Scorecard).

## Model

The model is a **recursive composite**:

- A **Brick** is the atomic, code-backed capability (question, play sound/music/video,
  display image, timer, an integration like Spotify). Its behaviour is code; its
  configuration is data.
- A **Segment** is a node in the tree: **either a leaf** (a single Brick) **or a group** (an
  ordered set of child Segments). Segments nest to any depth.
- A **Game** is the root group Segment plus metadata.
- **Scoring is owned by the Segment.** A leaf derives `{ position, points }` from its Brick's
  outcome; a group aggregates its children. The **Scorecard** is the root Segment's
  aggregated result.

Two ways to extend, by design:
- **New Game or sub-game** = compose existing Bricks/Segments — no code.
- **New Brick** (including a new integration) = code implementing the Brick contract (#13);
  instantly composable everywhere.

## Shape

```
Game = {
  schemaVersion: number            // 1; present from day one for forward migration
  id: string                       // stable opaque id, never a display name
  title: string
  meta: {
    description?: string
    authorNickname?: string
    createdAt: string              // ISO 8601
  }
  root: Segment                    // the top-level group
}

Segment =
  | {                              // group
      id: string
      kind: "group"
      scoring?: ScoringConfig      // how children combine (detail: #14)
      children: Segment[]          // executed in array order in v1
    }
  | {                              // leaf
      id: string
      kind: "brick"
      brick: { type: string; config: object }   // config is opaque here; owned by the Brick (#13)
      scoring?: ScoringConfig
    }

ScoringConfig = { aggregation: string; /* extended in #14 */ }
```

### Rules

- **Execution (v1) is linear**: a group runs its `children` in array order, depth-first.
  Conditional routing is deferred (see "v2" below) and adds no breaking change.
- **`brick.config` is opaque to the engine.** Its shape is defined and validated by each
  Brick's contract (#13). Answer types, question content, media params, and integration
  settings all live inline here — the Game document is self-contained.
- **`id`s are stable opaque strings**, unique within a Game, used as routing/reference keys.
- **`schemaVersion`** lets stored templates survive engine changes; bump it when the shape
  changes and provide a migration.

## v2 extension (non-breaking): conditional routing

Per the flow-engine research (`docs/research/flow-engine-patterns.md`), branching is added
**per group** later, without changing the shape above:

- A group gains an optional `entry: SegmentId` and each child an optional
  `next: SegmentId | null` and optional `branches: { when: PredicateDescriptor, target:
  SegmentId }[]`.
- `when` is a serializable predicate descriptor `{ op, field, value }` evaluated against the
  Segment Result — never embedded code (mirrors XState named guards / n8n condition-as-data).
- v1 (ordered `children`, no `next`) is the special case where none of these are present.

## Example

```json
{
  "schemaVersion": 1,
  "id": "game_fridaynight",
  "title": "Friday Night Quiz",
  "meta": { "authorNickname": "M", "createdAt": "2026-09-26T20:00:00Z" },
  "root": {
    "id": "seg_root",
    "kind": "group",
    "scoring": { "aggregation": "sum_points" },
    "children": [
      {
        "id": "seg_blindtest",
        "kind": "group",
        "scoring": { "aggregation": "sum_points" },
        "children": [
          { "id": "brk_music", "kind": "brick",
            "brick": { "type": "spotify", "config": { "playlistId": "pl_90s" } } },
          { "id": "brk_q1", "kind": "brick",
            "brick": { "type": "question",
                       "config": { "answerType": "free_text", "prompt": "Name the song",
                                   "answer": "…", "points": 10 } } }
        ]
      },
      {
        "id": "seg_simplequiz",
        "kind": "group",
        "scoring": { "aggregation": "sum_points" },
        "children": [
          { "id": "brk_q2", "kind": "brick",
            "brick": { "type": "question",
                       "config": { "answerType": "single_select", "prompt": "Capital of France?",
                                   "options": ["Paris", "Lyon", "Nice"], "answer": "Paris",
                                   "points": 5 } } }
        ]
      }
    ]
  }
}
```
