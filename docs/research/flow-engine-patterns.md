# Flow engine patterns: graph-of-nodes vs. state-machine, for Kuiz's Flow of Segments

This doc investigates how existing systems represent an executable, branchable sequence of steps as **plain data** — the same problem Kuiz faces for its **Flow** (an arrangement of **Segments**, linear in v1, conditionally branching later). It looks at n8n (workflow-automation graph model), XState (state-machine model), and quiz/party-game prior art for precedent on separating flow/content from scoring. This feeds Kuiz issue #12 (the game-definition schema): specifically, what shape the `flow`/`segments` field of a Game definition should take so it stays a plain JSON structure an LLM or MCP tool can construct and edit directly, without a compiler or DSL step.

## Sources consulted

- https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.if — official n8n docs for the IF node (two-output conditional branching)
- https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.switch — official n8n docs for the Switch node (multi-output conditional branching, rules vs. expression mode)
- https://docs.n8n.io/connect/n8n-api/workflow — official n8n API docs describing the workflow JSON shape (`name`, `nodes`, `connections`, `settings`) and confirming connections are "keyed by source node name"
- https://docs.n8n.io/connect/connect-to-n8n-mcp-server/mcp-server-tools-reference — official n8n docs for the MCP server's workflow-editing tools, including the `create_connection`-style tool whose params are source node, target node, `sourceIndex`/`fromOutput`, `targetIndex`/`toInput`, and `connectionType` (defaults to `main`) — useful precedent since Kuiz will also be authored via MCP tools
- https://docs.n8n.io/workflows/export-import/ (redirect/404 in current docs tree, content reconstructed via n8n's documented API shape and MCP tool reference above) — export/import of workflow JSON
- https://stately.ai/docs/guards — official Stately/XState v5 docs on guards: inline function guards vs. named string/object guards (`{ type, params }`) resolved via machine options or `setup()`
- https://stately.ai/docs/setup — official Stately/XState v5 docs on the `setup()` function: separating named, serializable-by-reference config from actual implementation functions
- https://stately.ai/blog/2023-12-01-xstate-v5 — official XState v5 release blog: `.cond` → `guard` rename, higher-order guards (`and`/`or`/`not`), unified action/guard argument, deep `getPersistedSnapshot()`/`snapshot` restore
- https://github.com/PixelsCamp/pixelscamp-quiz-stage — open-source multi-round, multi-display quiz-show engine (rounds as distinct stages feeding a shared scoreboard)
- https://github.com/hammre/party-box — open-source Jackbox-style party-game framework (client/broker/game split; does not itself prescribe a flow-vs-scoring separation)
- https://github.com/tomalama/hackbox — open-source Jackbox-style framework (server/client packages; architecture not documented in enough depth to cite specifics)

## Key findings

### n8n workflow JSON structure

An n8n workflow, whether fetched via the REST/MCP API or exported as a file, is a single JSON object with a small set of top-level fields: `name`, `nodes` (an array of node objects), `connections` (an object describing the graph edges), and `settings` (workflow-level options); exports also carry `id`, `active`, `versionId`, `staticData`, and metadata (n8n docs: workflow API). Each entry in `nodes` is self-contained — it carries its own `id`, `name`, `type`, `typeVersion`, `position`, and `parameters` — so a node's *identity and configuration* live entirely inside the node list, independent of where it sits in the graph.

The graph edges live separately, in `connections`, which n8n's own docs describe as "connections between nodes, keyed by source node name" (n8n docs: workflow API). Each node is queried by a lookup key equal to that source node's name, in this shape:

```json
{
  "connections": {
    "Set Question": {
      "main": [
        [
          { "node": "Ask Player", "type": "main", "index": 0 }
        ]
      ]
    }
  }
}
```

`main` is the connection *type* (n8n also has non-`main` connection types for AI sub-nodes, e.g. `ai_tool`); the outer array index is the *source output slot* (relevant for multi-output nodes like IF/Switch — see below); each inner array holds one or more `{ node, type, index }` target descriptors, where `index` is the *target's input slot*. This is confirmed by n8n's MCP-server tool reference, which documents a connection-creating tool taking a source node, a target node, `sourceIndex`/`targetIndex` (both defaulting to `0`), and a `connectionType` defaulting to `main` (n8n docs: MCP server tools reference). The key design point: **the node list is the set of vertices, and `connections` is a completely separate adjacency structure keyed by output slot** — nodes never point at their successors themselves.

### n8n conditional nodes (IF / Switch)

The IF node evaluates one or more comparison conditions (String/Number/Date&Time/Boolean/Array/Object types, combinable with AND/OR) and exposes exactly two outputs — `true` and `false` — so items that satisfy the condition exit output slot 0 and the rest exit output slot 1 (n8n docs: IF node). The Switch node generalizes this to N outputs: in "Rules" mode you author a list of routing rules, each attached to an output index, plus an optional fallback output for unmatched items; in "Expression" mode you instead declare a `Number of Outputs` and supply an expression that must evaluate to the numeric output index to use per item (n8n docs: Switch node). Crucially, **branching is not a special JSON shape** — it is just an ordinary node with more than one output slot, and the fan-out is expressed entirely in `connections` by having `connections["IF Node"].main` contain two arrays (index 0 for the true branch's targets, index 1 for the false branch's targets) instead of one. The conditional-routing *logic* (which condition, which comparator) lives in the node's own `parameters`; the *topology* (where each outcome goes next) lives in `connections`. That split — decision logic on the node, routing table in the edge structure — is the single most reusable idea from n8n for Kuiz.

### XState v5 machine config, states, and guards

An XState machine config is a plain object: an `id`, `initial` state key, and a `states` map, where each state can declare `on: { EVENT: { target, guard, actions } }` transitions. Guards can be written two ways: inline as a function (`guard: ({ context, event }) => ...`), which is not serializable, or as a **named reference** — a string (`guard: 'isValid'`) or a parameterized object (`guard: { type: 'isValid', params: {...} }`) — which XState resolves against a separate implementations table at machine-creation time, either via the legacy second argument to `createMachine(config, { guards: {...} })` or, in v5, via the `setup({ guards: {...} })` wrapper (Stately docs: guards; Stately docs: setup). XState v5 also added higher-order guard combinators — `and([...])`, `or([...])`, `not(guard)` — so composite conditions can themselves be expressed as data, e.g. `guard: and(['isAuthenticated', 'isAdmin', not('isBanned')])`, without writing a new function (Stately XState v5 blog).

### XState serializability

This named-reference pattern is exactly how XState resolves the classic "state machines aren't JSON" objection: the **config** (states, transitions, target names, guard/action *references*) is plain, storable, diffable data; only the **implementation** (what `isValid` actually checks, what `notifyPlayers` actually does) is a function, and that function table is supplied separately at runtime and never needs to travel with the config. In v5, `setup({ actions, guards, actors, delays })` is the canonical place to declare that implementation table, and it also gives the string references type safety (Stately docs: setup). Separately, XState v5 introduced deep, recursive persistence: `actor.getPersistedSnapshot()` captures the full actor tree (including spawned/invoked child actors) as serializable JSON, and `createActor(machine, { snapshot })` restores an actor from it (Stately XState v5 blog) — i.e., machine *config* and machine *snapshot* are both plain data; only the live actor and its implementation closures are not.

For a "linear now, branching later" flow, XState fits naturally: a v1 machine can be a straight chain of states each with a single unconditional `on: { NEXT: 'state2' }` transition (equivalent to n8n's single-output connection), and later, without changing the shape of the config format at all, a state's `on` block can grow additional guarded transitions (`{ target: 'stateA', guard: 'wonRound' }`, `{ target: 'stateB', guard: 'lostRound' }`) that are evaluated in order — the first one whose guard passes wins. The named-guard pattern means "wonRound" can be a small serializable predicate description (e.g. `{ type: 'scoreAbove', params: { threshold: 10 } }`) resolved by a fixed, Kuiz-owned table of predicate implementations, rather than arbitrary injected code.

### Quiz / party-game prior art for flow-vs-scoring separation

Public, documented prior art specific to "segment/round flow vs. scoring aggregation" is thin. The clearest example found is the Pixels Camp on-stage quiz engine (github.com/PixelsCamp/pixelscamp-quiz-stage), which structures its show as a fixed sequence of round types (several qualifying rounds feeding a final), with a quiz-master able to adjust scores or discard a question independently of round progression — evidence of an operational split between "which round is running" and "what the scoreboard says," even though the repo doesn't document a formal schema for it. Jackbox-style open-source clones (`hammre/party-box`, `tomalama/hackbox`) focus on the client/broker/big-screen transport layer (rooms, capabilities, broadcast vs. per-player messages) and leave each game's internal round/scoring structure entirely up to the game author, so they don't offer a reusable flow-definition schema either. No credible source describes a generalized, serializable "round graph + scoring aggregator" schema comparable to what issue #12 needs — the two DSL-shaped systems above (workflow automation, state machines) are the closest and most transferable analogues, not quiz-specific systems.

## Trade-offs

**n8n-style graph-of-nodes-with-typed-connections**
- Nodes and edges are fully decoupled: the edge table (`connections`) is a separate, appendable structure, so adding a new branch never touches the node/segment definitions themselves.
- Naturally supports multi-way fan-out (Switch-style) and even fan-in/merge without changing the core shape — an edge table scales to arbitrary graphs, including non-linear or cyclic ones, for free.
- Slightly more ceremony for the common linear case: even a straight A→B→C chain needs an edge table with one-entry arrays per node, and readers must jump between two structures (`nodes[i]` and `connections[nodes[i].name]`) to trace the flow.
- Keying by node *name* (as n8n does) is fragile under renames; Kuiz would want to key by a stable `id`.

**XState-style machine-with-guarded-transitions**
- The "next step" lives right next to the state that produces it (`states.segmentA.on.NEXT.target`), so a linear flow reads as a simple, local chain — closer to how a human or LLM authoring one Segment at a time would want to write `next`.
- Branching is added incrementally and locally: a state's transition list grows from one unconditional entry to several guarded ones, without introducing a new top-level structure the way n8n's `connections` object is separate from `nodes`.
- Guards-as-named-references (string or `{type, params}`) give exactly the "serializable predicate description" property Kuiz needs for MCP-tool authoring — no functions embedded in the document.
- Full XState brings machinery (actors, invoked services, hierarchical/parallel states, event-driven transitions) that is overkill for a linear-flow-of-segments; Kuiz doesn't need a generic event bus, just "this Segment finished, where next."

**For Kuiz specifically:** authoring happens through MCP tools operating on plain JSON (no compiler, no code-gen step), and v1 is linear with branching deferred. That argues for borrowing the *locality* of XState's transition-on-state approach (a segment carries its own "what happens after me" data, so one MCP tool call — "add Segment" — can also set its outgoing edge in the same call) while borrowing n8n's *edge-descriptor shape* (`{ target, ... }` objects that generalize cleanly from one target to several) and its *guard as small structured predicate* discipline. Neither system needs to be reproduced wholesale — Kuiz needs a minimal, purpose-built shape that takes cues from both.

## Concrete recommendation

Model the Flow as a flat `segments` array (not a separate nodes/edges pair) where each Segment carries its own outgoing routing inline, defaulting to a single implicit `next` field for v1 and generalizing to a `branches` array of guarded edges later — mirroring XState's "transition lives on the state" locality plus n8n's "guard/condition lives on the routing entry, not on the segment" separation.

**v1 (linear) shape:**

```json
{
  "flow": {
    "entry": "seg_intro",
    "segments": [
      {
        "id": "seg_intro",
        "type": "simple_quiz",
        "config": { "questionSetId": "qs_animals", "timeLimitSec": 20 },
        "next": "seg_blindtest"
      },
      {
        "id": "seg_blindtest",
        "type": "blind_test",
        "config": { "playlistId": "pl_90s" },
        "next": null
      }
    ]
  }
}
```

- `id`: stable Segment id (never a display name), used as the routing key — avoids n8n's name-keying fragility.
- `type`: the Segment Type (`simple_quiz`, `blind_test`, `themed_quiz`, ...), resolved by the engine's Segment Type registry.
- `config`: the Pieces that configure this Segment instance; opaque to the Flow engine itself.
- `next`: plain segment `id` string, or `null` to end the Flow. This is the entire v1 "connections object," but collapsed onto the segment instead of living in a separate top-level structure, since v1 has no fan-out to justify splitting it out.

**v2 (branching) extension — same array, no schema break:**

```json
{
  "id": "seg_final_quiz",
  "type": "simple_quiz",
  "config": { "questionSetId": "qs_finale" },
  "next": null,
  "branches": [
    {
      "when": { "op": "gte", "field": "result.points", "value": 10 },
      "target": "seg_bonus_round"
    },
    {
      "when": { "op": "lt", "field": "result.points", "value": 10 },
      "target": "seg_consolation"
    }
  ]
}
```

- `branches` is optional and only present once a Segment needs conditional routing; when present it takes priority over the plain `next` fallback (which remains as the default/no-match target, analogous to n8n Switch's fallback output).
- `when` is a small serializable predicate descriptor — `{ op, field, value }` — evaluated by a fixed, engine-owned set of predicate implementations (`gte`, `lt`, `eq`, ...) against the Segment Result the Flow engine just received, exactly matching XState's named-guard pattern (`{ type, params }` resolved via a lookup table) rather than n8n's node-per-condition or arbitrary injected code. `field` addresses into the standardized `{ position, points }` Segment Result shape (or, later, the aggregated Scorecard) so predicates never need engine internals.
- `target` is a plain Segment `id`, same as `next`, so the engine's routing resolution logic ("given the Segment Result, what's the next Segment id?") is the single function that handles both the v1 and v2 cases — v1 is simply the special case where `branches` is absent.

This keeps the whole Flow a single, flat, LLM-editable JSON array (an MCP tool can insert/reorder/patch one Segment object at a time without touching an out-of-band edge table), keeps guards as inert data rather than code, and gives issue #12 a concrete, versionable schema shape: `Flow = { entry: SegmentId, segments: Segment[] }`, `Segment = { id, type, config, next: SegmentId | null, branches?: { when: PredicateDescriptor, target: SegmentId }[] }`, feeding directly into how the engine turns each Segment's Segment Result into the next Segment to run, and ultimately into the Scorecard the engine aggregates across the whole Flow.
