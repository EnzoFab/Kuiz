import { randomUUID } from "node:crypto";
import {
  initSession,
  reduceSession,
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
}

function makeCode(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

export class SessionStore {
  private readonly byId = new Map<string, StoredSession>();
  private readonly idByCode = new Map<string, string>();

  constructor(private readonly resolve: BrickResolver) {}

  create(game: Game, mode: "online" | "offline" = "online"): StoredSession {
    const id = randomUUID();
    let code = makeCode();
    while (this.idByCode.has(code)) {
      code = makeCode();
    }
    const session: StoredSession = { id, code, game, state: initSession(game, { mode }) };
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
    session.state = reduceSession(session.game, session.state, event, { resolve: this.resolve });
    return session;
  }
}
