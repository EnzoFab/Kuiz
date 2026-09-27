# Online session lifecycle & realtime protocol (v1)

Status: **decided** (wayfinder ticket #7). Wraps the flow-execution engine (#5) in the
realtime layer (Socket.IO, `docs/research/realtime-stack.md`): how players join, how messages
flow, and what each participant may see. Feeds #11 (build plan).

## Lifecycle

`create → (share/roster) → join → lobby → play → results`

1. **Create** — the Game Master creates a Session from a Game, choosing a **join mode** (below).
   Server returns a short **join code** (4–6 chars) and a link `/join/<code>`.
2. **Join** — players enter via the link + code (see modes).
3. **Lobby** — players gather; GM sees the roster.
4. **Play** — GM starts; the engine runs (see #5); scores update incrementally.
5. **Results** — final Scorecard.

Code + Session are **ephemeral** — they die when the Session ends.

## Join modes (Q1)

Chosen at creation, stored on the Session:

- **Open** — anyone with the link + code joins by entering a **nickname**. Player count is
  effectively unlimited. Nickname collisions get a numeric suffix.
- **Private** — the Game Master **pre-creates the roster** (player names) before starting. A
  joiner with the link + code **claims** an unclaimed player slot from the list; no free-form
  nicknames. Play can't exceed the roster.

## Player identity & reconnection

- On join/claim, the server assigns a **playerId**, returned to the client and **persisted in
  localStorage**.
- **Reconnection** = client resends its playerId → server re-associates the socket → sends the
  current session snapshot. In **private** mode, the playerId↔slot binding is what a reconnect
  restores (you get your claimed player back).

## Realtime protocol (Q2)

A thin transport over #5's `SessionEvent`s — the socket layer invents no game logic. One
Socket.IO **Room per Session** for broadcast.

- **Client → server:**
  - `CREATE_SESSION { gameId, joinMode, roster? }`
  - `JOIN { code, nickname }` (open) / `CLAIM { code, playerSlotId }` (private)
  - `INPUT { … }` → dispatched as `PLAYER_INPUT`
  - GM-only: `START`, `ADVANCE`, `PAUSE`, `KICK`
- **Server → client:**
  - `STATE { view }` — the **projection** (see Q3), pushed after each transition
  - `JOINED { playerId }`, `ERROR { code, message }`

Client messages become `SessionEvent`s dispatched into `reduceSession`; the server then
projects and broadcasts. All game logic stays in the pure reducer; the socket layer is the
impure shell (with timers, server handlers, broadcast — see #5).

## State projection & visibility (Q3)

The server never broadcasts raw `SessionState`. A **`project(session, viewer)`** step produces
a per-recipient view:

- A **Player** sees their own state + the Scorecard, **never** other players' answers or an
  unrevealed correct answer (anti-cheat + correct UX).
- The **Game Master** sees a fuller control view (lobby, progress, who's answered).
- Each **Brick** contributes its own projection rule — what it hides mid-play vs at reveal — as
  part of the Brick contract (#13).

**v1 keeps it simple:** players see nothing of each other beyond the Scorecard. Chat and
player-to-player interaction are **deferred**.

## Roles (Q4)

Two client roles with distinct views:

- **Player** — join/claim, answer, see own state + Scorecard.
- **Game Master** — control (start / advance / skip / pause / kick), see lobby + progress.

A separate **shared big-screen / TV projection** for online play (a third read-only view) is a
natural reuse of `project()` but **deferred** in v1.

## SessionState additions (extends #5)

`SessionState` gains `joinMode: "open" | "private"`; in private mode, `players` entries are
pre-created with a `claimed: boolean`. Everything else (cursor, brickState, results,
scorecard) is unchanged and still fully serializable.

## Deferred

Shared big-screen projection; chat / player interaction; open-mode player caps & moderation.
