import { randomUUID } from "node:crypto";
import {
  initSession,
  orderedLeaves,
  reduceSession,
  type BrickDefinition,
  type BrickResolver,
  type Game,
  type SessionEvent,
  type SessionState,
} from "@kuiz/core";

/**
 * In-memory session store (v1). Holds live Session state keyed by id, with a short join
 * code lookup. Ephemeral — a session dies when the process does / it is removed. The Redis
 * path for multi-node is deferred (see docs/research/realtime-stack.md).
 */

export interface StoredSession {
  id: string;
  code: string;
  game: Game;
  state: SessionState;
  /** playerId of the Game Master (the creator). */
  hostId?: string;
}

/** Resolves a Brick's full definition by type — needed for the optional `server` handler. */
export type BrickDefResolver = (type: string) => BrickDefinition | undefined;

/**
 * A Brick whose current reducer state exposes a non-null `pendingServerRequest` is asking
 * the server handler to run; the handler's result re-enters `reduce` (clearing the request).
 * This is the only shape the shell reads out of the otherwise-opaque brickState.
 */
interface PendingServer {
  pendingServerRequest?: unknown;
}

function makeCode(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

export class SessionStore {
  private readonly byId = new Map<string, StoredSession>();
  private readonly idByCode = new Map<string, string>();

  /**
   * @param resolve  Brick logic resolver (drives the pure engine).
   * @param defFor   Brick definition resolver, for the optional async `server` handler.
   * @param now      Server clock injected into the engine (brick start time, etc.).
   */
  constructor(
    private readonly resolve: BrickResolver,
    private readonly defFor?: BrickDefResolver,
    private readonly now: () => number = () => Date.now(),
  ) {}

  create(
    game: Game,
    mode: "online" | "offline" = "online",
    joinMode: "open" | "private" = "open",
  ): StoredSession {
    const id = randomUUID();
    let code = makeCode();
    while (this.idByCode.has(code)) {
      code = makeCode();
    }
    const session: StoredSession = { id, code, game, state: initSession(game, { mode, joinMode }) };
    this.byId.set(id, session);
    this.idByCode.set(code, id);
    return session;
  }

  get(id: string): StoredSession | undefined {
    return this.byId.get(id);
  }

  getByCode(code: string): StoredSession | undefined {
    const id = this.idByCode.get(code.toUpperCase());
    return id ? this.byId.get(id) : undefined;
  }

  /** Apply an event through the pure engine and store the new state. */
  apply(id: string, event: SessionEvent): StoredSession | undefined {
    const session = this.byId.get(id);
    if (!session) {
      return undefined;
    }
    session.state = reduceSession(session.game, session.state, event, {
      resolve: this.resolve,
      now: this.now,
    });
    return session;
  }

  /**
   * If the current Brick has a `server` handler and its reducer state has posted a request,
   * run the handler and feed the result back into the engine as a `SERVER_RESULT`. The impure
   * shell of the flow engine (integrations, AI) lives here; the reducer stays pure. One shot —
   * a request posted by the result is drained on the next transition. No-op unless a `defFor`
   * was given and the current Brick both has a handler and a pending request.
   */
  async runServerHandler(id: string): Promise<void> {
    const session = this.byId.get(id);
    if (!session || !this.defFor) {
      return;
    }
    const cursor = session.state.cursor;
    const leaf = cursor == null ? undefined : orderedLeaves(session.game.root).find((l) => l.id === cursor);
    const handler = leaf && this.defFor(leaf.brick.type)?.server;
    const request = (session.state.brickState as PendingServer | null)?.pendingServerRequest;
    if (!leaf || !handler || request == null) {
      return;
    }
    const result = await handler.resolve(leaf.brick.config, request);
    session.state = reduceSession(session.game, session.state, result, {
      resolve: this.resolve,
      now: this.now,
    });
  }
}
