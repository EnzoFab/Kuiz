# Realtime (WebSocket) Stack for Kuiz Sessions

Kuiz needs to push realtime state to many connected clients within a **Session** (the live instance of a Game being played) — question changes, timers, scores, and player join/leave — for a React web client today and a React Native client later, sharing a TypeScript types package for message contracts. The v1 target is a single Node process, but the architecture should not preclude scaling horizontally to multiple nodes. This document researches the right WebSocket library/framework and the right place to hold ephemeral Session state (current question, timers, scores, connected players), against primary sources only.

## Sources consulted

- `ws` (websockets/ws) GitHub repo and README/API doc — https://github.com/websockets/ws and https://github.com/websockets/ws/blob/master/doc/ws.md
- Socket.IO official docs — https://socket.io/docs/v4/
- Socket.IO Rooms — https://socket.io/docs/v4/rooms/
- Socket.IO Redis adapter — https://socket.io/docs/v4/redis-adapter/
- Socket.IO TypeScript guide — https://socket.io/docs/v4/typescript/
- Socket.IO client installation docs — https://socket.io/docs/v4/client-installation/
- Socket.IO "How to use with React Native" — https://socket.io/how-to/use-with-react-native
- React Native networking docs (built-in WebSocket support) — https://reactnative.dev/docs/network
- uWebSockets.js README/repo — https://github.com/uNetworking/uWebSockets.js/
- Ably docs (hosted pub/sub) — https://ably.com/docs
- tRPC subscriptions docs — https://trpc.io/docs/server/subscriptions
- Colyseus docs (via search of docs.colyseus.io) — https://docs.colyseus.io/ and https://docs.colyseus.io/room

## Key findings

### `ws` (raw WebSocket library)

`ws` is a low-level WebSocket protocol implementation, not a framework. Per its GitHub README, it is "simple to use, blazing fast, and thoroughly tested," but it is a protocol layer, not a features layer. Concretely:

- **Reconnection**: not provided. The client-side reconnect loop (with backoff) would have to be hand-written for both the React and React Native clients.
- **Rooms/broadcast**: not provided. The docs show a manual pattern (`wss.clients.forEach(...)`) for broadcasting to all connected sockets; grouping clients into a "Session room" and excluding the sender is entirely custom code you'd own and maintain.
- **Backpressure**: `ws` exposes `bufferedAmount` on each socket — "the number of bytes of data that have been queued using calls to `send()` but not yet transmitted to the network" (ws.md API doc) — but does not do anything with it automatically; you must poll it yourself to throttle slow clients.
- **Liveness**: `ws` includes a ping/pong heartbeat primitive and documents a "How to detect and close broken connections?" FAQ pattern, but again this is something you assemble, not something you get by importing the library.
- **Horizontal scaling**: entirely out of scope for `ws` — there is no pub/sub or cross-process concept at all; a multi-node deployment would require building your own broadcast fan-out (e.g., a Redis pub/sub channel that every node subscribes to) from scratch.

Bottom line: `ws` is the right choice only if you want full control and are willing to reimplement reconnection, rooms, heartbeats, and scale-out messaging yourself.

### Socket.IO

Socket.IO is a framework built on top of the WebSocket/HTTP-polling transport that provides most of what a Session-based quiz game needs out of the box:

- **Reconnection**: built into the client. Per the official docs, Socket.IO uses "a heartbeat mechanism, which periodically checks the status of the connection," and on disconnect the client "automatically reconnect[s] with an exponential back-off delay, in order not to overwhelm the server" (socket.io/docs/v4/).
- **Rooms**: "A room is an arbitrary channel that sockets can join and leave. It can be used to broadcast events to a subset of clients" (socket.io/docs/v4/rooms/). Sockets join with `socket.join("room-name")`, broadcast with `io.to("room").emit(...)` or `socket.to("room").emit(...)` (excludes sender), and "upon disconnection, sockets leave all the channels they were part of automatically, and no special teardown is needed" — this maps almost one-to-one onto a Kuiz Session: one room per Session id, join on player-join, and disconnect cleanup is free.
- **Namespaces**: a second grouping mechanism ("split the logic of your application over a single shared connection") that could separate e.g. host/admin channels from player channels if needed later.
- **Packet buffering**: "Packets are automatically buffered when the client is disconnected, and will be sent upon reconnection" (socket.io/docs/v4/) — useful so a player who drops for a few seconds doesn't silently miss a scoring update.
- **Horizontal scaling / broadcast**: broadcasting "also works when scaling to multiple nodes" once the Redis adapter is installed (socket.io/docs/v4/). The **@socket.io/redis-adapter** docs are explicit about scope: "every packet that is sent to multiple clients ... is sent to all matching clients connected to the current server, published in a Redis channel, and received by the other Socket.IO servers of the cluster" — and critically, **it is pub/sub only**: "the Redis adapter uses the Pub/Sub mechanism to forward the packets between the Socket.IO servers, so there are no keys stored in Redis" (socket.io/docs/v4/redis-adapter/). This is an important distinction for Kuiz: the adapter solves cross-node message fan-out, it does **not** give you a shared place to store Session state (current question, scores, timers) — that's a separate concern (see next section).
- **TypeScript**: first-class typed events via four generic interfaces — `ServerToClientEvents`, `ClientToServerEvents`, `InterServerEvents`, `SocketData` — passed as generics to `Server<...>` on the server and `Socket<...>` on the client, with the client reusing the same interfaces "reversed" (socket.io/docs/v4/typescript/). This is exactly the shape needed for a shared `@kuiz/types` package: define the event contracts once, import on both server and client.

### Other options considered

- **uWebSockets.js** (uNetworking/uWebSockets.js on GitHub): a native C++ addon exposed to Node, marketed as extremely fast ("claims 13x faster than Fastify" per its release notes) and low-level, roughly at the same abstraction level as `ws` (no rooms/broadcast helpers built in) but with explicit backpressure primitives (`getBufferedAmount()`, per-socket backpressure thresholds and drain handlers). Worth knowing about for a future performance-critical rewrite, but for v1 it would mean rebuilding all the same room/reconnect/broadcast machinery Socket.IO already gives you, for a game that is not CPU- or connection-count-bound at launch. Not a good fit for v1.
- **Colyseus** (docs.colyseus.io): a Node.js framework purpose-built for "authoritative game servers — with real-time state synchronization, matchmaking, and effortless integration into any game engine." Its Room class is architecturally almost exactly a Kuiz Session: "each room instance represents an isolated game session where clients can interact through shared state and messages," with automatic binary state-diff sync to clients. This is the closest conceptual match to Kuiz's domain model, and worth a second look if the online-mode engine grows complex (e.g., needs continuous state sync rather than discrete events). For v1 it's more framework/lock-in than needed for a quiz-question/answer/score event model, and it lacks Socket.IO's ecosystem maturity and React Native track record.
- **tRPC subscriptions** (trpc.io/docs/server/subscriptions): tRPC can stream events over WebSockets (`wsLink`) or SSE, and the docs actually recommend SSE over WebSockets by default "as it's easier to setup and doesn't require setting up a WebSocket server." This fits one-way server→client streams with type-safety derived from your existing tRPC router, but it does not give you rooms, presence, or a built-in cross-node broadcast story — you'd be building the same room/broadcast logic as with raw `ws`. Better suited to simpler live-update feeds than to a room-based multiplayer session with bidirectional player actions.
- **Ably / Pusher** (hosted pub/sub, e.g. ably.com/docs): fully managed realtime infrastructure — channels, presence (who's connected), guaranteed delivery — removes all self-hosting/scaling concerns entirely. Trade-off is recurring cost and a hosted dependency for what is currently a core piece of the product; reasonable fallback if operating your own WebSocket layer becomes a burden, but unnecessary for a v1 single-node deployment you already control.

## Ephemeral state: in-memory vs Redis

Two questions are easy to conflate here and the sources above make the boundary explicit:

1. **Message fan-out across processes** (who tells every other Node process "a packet was broadcast to this room") — solved by the Socket.IO Redis adapter, which is pub/sub only and "there are no keys stored in Redis" (socket.io/docs/v4/redis-adapter/).
2. **Where the actual Session state lives** (current question index, per-player scores, timer deadlines, connected-player roster) — a completely separate concern that the Redis adapter does not address at all.

For v1 on a single Node process, holding Session state in plain in-memory structures (e.g. a `Map<sessionId, SessionState>` in process memory) is the right choice:
- Zero extra infrastructure to run or operate.
- Fastest possible read/write path — no serialization or network hop for the engine's per-Segment scoring computation.
- Correct and sufficient as long as exactly one process owns all Sessions (true for a single-node v1), since every request for a given Session id is guaranteed to land on the same process.

The moment you scale beyond one Node process, in-memory state breaks: two players in the same Session could be routed (by a load balancer or by process restart) to different processes, each with its own disjoint copy of "the" Session state. At that point Session state needs to live somewhere all processes can read/write, and Redis is the natural choice for the same reasons this research surfaced for pub/sub: it's fast, supports TTL/expiry (natural fit for ephemeral Sessions), and is already an infra dependency once you add the Socket.IO Redis adapter for broadcast. But note again: **the Redis adapter and "Redis as your Session-state store" are two different uses of the same Redis instance** — the adapter's pub/sub channels do not persist or share your domain data; you would add your own key scheme (e.g. `session:<id>` holding serialized `SessionState`) independently of wiring up the adapter.

## Client fit

- **React web**: `socket.io-client` is the natural fit — mature, widely used with React via a small custom hook wrapping `useEffect`/`useRef` around the socket instance (a common pattern documented informally, not a built-in Socket.IO hook API, but the socket instance is a plain object usable inside any hook).
- **React Native**: React Native ships a built-in WebSocket API — "React Native also supports WebSockets, a protocol which provides full-duplex communication channels over a single TCP connection" (reactnative.dev/docs/network) — with the same `onopen`/`onmessage`/`onerror`/`onclose` handlers as browser WebSocket. Socket.IO explicitly documents React Native as a supported target: "All tips from our React guide can be applied with React Native as well" (socket.io/how-to/use-with-react-native), with platform-specific notes — use `10.0.2.2` for the Android emulator, enable CORS on the server, and for Android 9+ enable cleartext traffic explicitly during development since "cleartext traffic is blocked by default." No blockers, just a few environment-specific connection details.
- **Shared TypeScript types package**: Socket.IO's typed-event generics (`ServerToClientEvents`, `ClientToServerEvents`, `InterServerEvents`, `SocketData` — socket.io/docs/v4/typescript/) are designed to be declared once and imported by both the `Server<...>` instantiation and the `Socket<...>` instantiation on the client. This lines up cleanly with Kuiz's plan for a shared TypeScript types package: put those four interfaces (or the payload types they reference) in that package, and both the React and future React Native clients get compile-time-checked event contracts against the same source of truth as the server.

## Trade-offs summary

| Option | Reconnection | Rooms/broadcast | Backpressure visibility | Multi-node scaling | Fit for Kuiz v1 |
|---|---|---|---|---|---|
| `ws` | Build yourself | Build yourself | `bufferedAmount` exposed, manual | Build yourself (e.g. own Redis pub/sub) | Too much to build for v1 |
| **Socket.IO** | Built in, exponential backoff | Built in (Rooms = Session mapping) | Handled internally; adapter documents Redis outage behavior | `@socket.io/redis-adapter`, official, drop-in | **Best fit** |
| uWebSockets.js | Build yourself | Build yourself | Fine-grained (`getBufferedAmount()`, drain handler) | Build yourself | Overkill/premature for v1 |
| Colyseus | Built in | Built in (Room = Session, even closer match) | Not centrally documented | Has its own presence/matchmaking server model | Strong candidate for a v2 rewrite if state-sync needs grow |
| tRPC subscriptions | Built in (reconnect + `tracked()`) | Not provided | Not documented | Not provided | Better for simple one-way feeds, not multiplayer rooms |
| Ably/Pusher (hosted) | Built in | Channels + presence built in | Handled by vendor | Handled by vendor | Viable fallback, unnecessary cost/dependency for v1 |

## Recommendation

**Use Socket.IO for the realtime layer, and hold Session state in-memory in the Node process for v1, with a clear, named path to Redis for both concerns when scaling to multiple nodes.**

Concretely:

1. **Realtime library**: Socket.IO server + `socket.io-client` on both the React web app and the future React Native app. One Room per Session id (`io.to(sessionId).emit(...)`), joined on player-join and left automatically on disconnect — this needs zero custom room-membership code, per the Rooms docs.
2. **Typed contracts**: define `ServerToClientEvents` / `ClientToServerEvents` / `InterServerEvents` / `SocketData` in the shared TypeScript types package now, even before React Native exists, so both clients type-check against the same event contracts from day one.
3. **Ephemeral Session state (v1)**: a plain in-memory `Map<sessionId, SessionState>` (or equivalent class-based session-manager) inside the single Node process. No Redis, no extra infra, simplest possible correct implementation for a single-process deployment.
4. **Concrete path to multi-node later** — do these two things together, not one without the other, since they solve different problems:
   - Add `@socket.io/redis-adapter` (plus `redis` or `ioredis` client) so `io.to(room).emit(...)` fans out across all Node processes — this is a small, well-documented, official change (`io.adapter(createAdapter(pubClient, subClient))`).
   - Move `SessionState` out of the in-process `Map` into Redis itself (e.g. `session:<id>` as a JSON blob or hash, with a TTL matching Session lifecycle), so any process handling a request for a given Session id reads/writes the same authoritative state, instead of each process holding its own copy. This is a distinct migration from step one — the Redis adapter's pub/sub channels do not carry your domain state, so this data-layer move has to be done explicitly.

This keeps v1 minimal (one process, one in-memory map, no Redis to operate) while making the eventual multi-node move a well-scoped, two-part change rather than an architecture rewrite.
