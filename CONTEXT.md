# Kuiz

Kuiz is a platform for composing and playing quiz-style party games. A game master
builds a game from reusable pieces (like an n8n flow), then runs it as a session that
players join — online on their phones, or offline on a shared display driven by the game
master. Its central bet is extensibility: new kinds of sub-game must be addable without
changing the core engine.

## Language

### Building a game

**Game**:
The composed blueprint of a game — a Flow of Segments plus their configuration. A
recipe, not an instance of play.
_Avoid_: Quiz, game definition (use "Game")

**Flow**:
The arrangement of Segments that makes up a Game. A graph capable of conditional
branching (n8n-like); in v1 it is typically linear. The engine executes the Flow.
_Avoid_: Pipeline, graph

**Segment**:
One self-contained sub-game within a Flow (e.g. a quiz round, a blind-test round). The
unit of extensibility: a new kind of sub-game is a new Segment Type, added without
touching the core engine. A Segment is configured from finer Pieces and, when played,
emits a Segment Result.
_Avoid_: Sub-game, round, mini-game, node, step (use "Segment"; "sub-game" is fine in
prose but "Segment" is the modelled term)

**Segment Type**:
The reusable kind a Segment is an instance of (Simple Quiz, Blind Test, Themed Quiz…).
Implements the Segment contract: a config schema, runtime behaviour, and result emission.

**Piece**:
A finer composable unit that configures a Segment (e.g. question source, question type,
scoring rule, media, timer). The composable unit *inside* a Segment; the Segment is the
composable unit *inside* the Flow.
_Avoid_: Block, component, part

**Template**:
A pre-made Game published as a starting point — authored by the platform owner in v1, and
by players in later versions.

### Playing a game

**Session**:
One instance of a Game being played. Has a lifecycle: create → join → play → results. An
online Session is realtime; scoring updates as play advances.
_Avoid_: Match, room, lobby, instance (a lobby is a phase of a Session)

**Game Master**:
The person who authors a Game and hosts its Session.
_Avoid_: Host, admin, creator, GM in modelled names (write it out)

**Player**:
A participant in a Session.

**Online mode**:
Players join a Session on their own phones; play is realtime and the engine computes
scores after each question/Segment.

**Offline mode**:
The Game Master displays the Game on a shared screen (TV/projector) and walks through the
steps manually. No player devices and no scoring in v1; manual scoring is a later
addition.

### Scoring

**Segment Result**:
What a Segment returns to the Flow when it finishes: a per-player entry of
`{ position, points }`. Standardized across all Segment Types so the engine can aggregate
without knowing the Segment's internals.

**Scorecard**:
The overall score across all Segments, aggregated by the engine from each Segment Result.
How results combine is configurable ("different types of rating" — e.g. sum of points,
count of Segment wins, best positions).
_Avoid_: Leaderboard, overall score, standings (use "Scorecard")
