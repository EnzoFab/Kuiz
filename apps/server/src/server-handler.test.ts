import { describe, it, expect } from "vitest";
import { parseGame, type BrickDefinition, type Game, type SessionEvent } from "@kuiz/core";
import { SessionStore } from "./sessions.js";

/**
 * Exercises the optional async Brick `server` handler hook (B14) with a stub: a Brick that,
 * on start, posts a `pendingServerRequest`; the shell's drain calls the handler, whose result
 * re-enters the reducer as SERVER_RESULT and clears the request.
 */

interface StubState {
  pendingServerRequest: string | null;
  resolved: string | null;
}

const stubBrick: BrickDefinition<Record<string, unknown>, StubState, SessionEvent> = {
  type: "stub-server",
  capabilities: { interactive: false, scoring: false, needsServer: true, modes: ["online"] },
  logic: {
    init: () => ({ pendingServerRequest: "fetch-me", resolved: null }),
    reduce: (_config, state, ev) => {
      if (ev.type === "SERVER_RESULT") {
        return { pendingServerRequest: null, resolved: ev.payload as string };
      }
      return state;
    },
    isComplete: (state) => state.resolved != null,
    outcome: () => null,
  },
  server: {
    resolve: async (_config, request) => ({ type: "SERVER_RESULT", payload: `handled:${String(request)}` }),
  },
};

const game: Game = parseGame({
  schemaVersion: 1,
  id: "stub",
  title: "Stub",
  meta: { createdAt: new Date().toISOString() },
  root: {
    id: "root",
    kind: "group",
    scoring: { aggregation: "sum_points" },
    children: [{ id: "s1", kind: "brick", brick: { type: "stub-server", config: {} } }],
  },
});

describe("server handler hook", () => {
  const defFor = (type: string): BrickDefinition | undefined =>
    type === "stub-server" ? (stubBrick as BrickDefinition) : undefined;
  const resolve = (type: string) => defFor(type)!.logic;

  it("drains a pending server request and feeds the result back as SERVER_RESULT", async () => {
    const store = new SessionStore(resolve, defFor);
    const session = store.create(game);
    store.apply(session.id, { type: "START" });
    expect((store.get(session.id)!.state.brickState as StubState).pendingServerRequest).toBe("fetch-me");

    await store.runServerHandler(session.id);

    const after = store.get(session.id)!.state.brickState as StubState;
    expect(after.resolved).toBe("handled:fetch-me");
    expect(after.pendingServerRequest).toBeNull();
  });

  it("is a no-op when no definition resolver is wired", async () => {
    const store = new SessionStore(resolve); // no defFor
    const session = store.create(game);
    store.apply(session.id, { type: "START" });
    await store.runServerHandler(session.id);
    expect((store.get(session.id)!.state.brickState as StubState).resolved).toBeNull();
  });
});
