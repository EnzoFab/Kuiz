# Offline walkthrough runtime (v1)

Status: **decided** (wayfinder ticket #8). Offline mode = a single device, Game Master only,
no player devices. It reuses the flow-execution engine (#5) and the Brick views (#13) almost
entirely. Feeds #11 (build plan).

See [`CONTEXT.md`](../../CONTEXT.md): **Offline mode**.

## Same engine, same views

- The GM walks the same Segment tree via the same `reduceSession`.
- Each Brick renders its **existing `Play` view** in a **host/presentation** context — no new
  rendering path.
- The per-viewer projection (#7) collapses to a single **host view** (`project(session, GM)`).

## GM controls & per-Brick flow

The GM drives every step:

- **Interactive Brick** (e.g. question): `present → (GM: reveal) → (GM: next)`. `reveal` is the
  same Brick reveal event used online (shows the correct answer on screen); **no
  `PLAYER_INPUT` is collected**.
- **Presentational Brick** (image/sound/media): `present → (GM: next)`.
- Controls: **next** (`ADVANCE { source: "host" }`), **reveal**, **replay/back**.

## No scoring in v1

No player input → no outcomes → no Scorecard. Players answer out loud / on paper; the GM
just reveals and advances. **Manual GM-entered scoring is deferred** (design-for only).

## "Offline" means no player devices, not no internet (Q3)

- The engine runs **client-side** with no player sockets.
- Brick **server handlers still work** when the device is online — an integration Brick (e.g.
  Spotify) calls the backend for its data as usual.
- A Brick that truly requires realtime multiplayer declares `capabilities.modes: ["online"]`
  and is **filtered out** of offline games at authoring / session start. This is the concrete
  use of `capabilities.modes` from the Brick contract (#13).

## Offline shell

The impure shell (#5) is trivial locally: no broadcast, no player sockets; optional backend
calls for Brick server handlers. Same pure core (`reduceSession` + Brick reducers) as online.

## Summary vs online

| | Offline (v1) | Online |
|---|---|---|
| Devices | one (GM) | GM + player phones |
| Player input | none | yes |
| Advance | GM each step | auto (all-answered/timeout) + host override |
| Scoring / Scorecard | none (deferred) | incremental |
| Projection | single host view | per-viewer |
| Network | client-side; backend only for Brick server handlers | server-authoritative |
| Core reducer + views | identical | identical |
