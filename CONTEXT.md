# Kuiz

Kuiz is a platform for composing and playing quiz-style party games. A game master builds a
game by composing reusable bricks (like an n8n flow), then runs it as a session that players
join — online on their phones, or offline on a single device the game master drives. Its
central bet is extensibility: new capabilities are added as new Bricks (code) without
changing the core engine, while new sub-games and games are pure composition (no code).

## Language

### Building a game

**Brick**:
The atomic, code-backed capability — the single unit that carries code and the only thing an
extension needs to add. Each Brick owns its own authoring form, display, and play logic, and
may wrap an external integration (e.g. Spotify). Its logic is a pure reducer
(`init`/`reduce`/`isComplete`/`outcome`) over plain-JSON state; see
`docs/spec/brick-contract.md`. Examples: a question (see **Answer type**), play sound / music
/ video, display image, timer, an API-integration brick.
_Avoid_: Piece, block, component, node (all mean Brick; "piece" is fine in casual prose).

**Interactive brick / Presentational brick**:
A Brick is one of two kinds. An **interactive** Brick collects player input and emits an
outcome (e.g. a question). A **presentational** (read-only) Brick just presents something and
emits no outcome (e.g. display image, play sound), completing on a timer or a next action.

**Answer type**:
The kind of answer a question Brick accepts — free text, single select, multiple select,
true/false, buzzer, etc. A shared option set any question Brick can use.

**Answer checker**:
The strategy a question Brick uses to grade a free-text answer — `exact`, `fuzzy` (tolerant of
spelling, pure), or `ai` (semantic, runs via the Brick's server handler). Produces a match
score the Segment turns into points.

**Segment**:
A node in a Game's composition tree: **either a single Brick (leaf) or an ordered set of
Segments (a group)**. Segments nest to any depth — a Game is the root group Segment, a
"sub-game" is a group Segment, a single question is a leaf Segment. The unit of composition
and of scoring.
_Avoid_: round, mini-game, step (a "sub-game" is a group Segment).

**Segment Type**:
A named, reusable **preset composition** of Segments/Bricks, published as a starting point —
e.g. Simple Quiz, Themed Quiz, Blind Test. It is **data, not code**: a saved arrangement of
Bricks, authored by the platform owner or (later) players.
_Avoid_: treating a Segment Type as a hardcoded class.

**Game**:
The whole composition — the root group Segment plus metadata (title, author, scoring). A
portable, self-contained document that is stored, shared, and played.
_Avoid_: Quiz.

**Flow**:
The ordered execution of a Game's Segment tree (depth-first, in child order). Linear in v1;
conditional branching between sibling Segments is a later extension.
_Avoid_: Pipeline, graph.

**Catalog**:
The browsable library a Game Master picks from when building — both **Bricks** (atomic
capabilities) and **Segment Types** (preset sub-game compositions). It grows by adding a
Brick (code) or publishing a Segment Type (composition).
_Avoid_: game catalog (use "Catalog").

**Template**:
A published **Game** (whole) used as a starting point. (A Segment Type is the same idea one
level down, at the sub-game level.)

### Playing a game

**Session**:
One instance of a Game being played. Has a lifecycle: create → join → play → results. An
online Session is realtime; scoring updates as play advances.
_Avoid_: Match, room, lobby, instance (a lobby is a phase of a Session).

**Game Master**:
The person who authors a Game and hosts its Session.
_Avoid_: Host, admin, creator, GM in modelled names (write it out).

**Player**:
A participant in a Session.

**Online mode**:
Players join a Session on their own phones; play is realtime and the engine computes scores
after each question/Segment.

**Offline mode**:
A single-device mode: the Game Master runs the Game alone on the app (optionally shown on a
shared screen / TV) and advances the steps himself. No players join on their own devices and
no scoring in v1; manual scoring is a later addition. Mode is chosen when a Session is
created, not declared on the Game.

### Scoring

**Segment Result**:
What a Segment returns to its parent when it finishes: a per-player `{ position, points }`.
A leaf Segment derives it from its Brick's outcome; a group Segment aggregates its children's
Segment Results. Scoring is owned by the Segment, never the Brick.

**Scorecard**:
The Game's overall score — the root Segment's aggregated Segment Result. How child results
combine is configurable per group ("different types of rating" — e.g. sum of points, count of
wins, best positions).
_Avoid_: Leaderboard, overall score, standings (use "Scorecard").
