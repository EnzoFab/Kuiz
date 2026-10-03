import { describe, it, expect } from "vitest";
import { parseGame, type Game } from "./schema.js";
import type { BrickLogic, BrickResolver } from "./brick.js";
import type { BrickOutcome } from "./scoring.js";
import { initSession, orderedLeaves, reduceSession } from "./engine.js";
import type { SessionState, SessionEvent } from "./session.js";

// A stub interactive Brick: completes after one PLAYER_INPUT; emits facts for player A.
const tapBrick: BrickLogic<unknown, { done: boolean }, SessionEvent, BrickOutcome> = {
  init: () => ({ done: false }),
  reduce: (_c, state, ev) => (ev.type === "PLAYER_INPUT" ? { done: true } : state),
  isComplete: (state) => state.done,
  outcome: () => ({ perPlayer: { A: { correct: true } } }),
};

// A stub presentational Brick: complete immediately, no outcome.
const showBrick: BrickLogic<unknown, Record<string, never>, SessionEvent, never> = {
  init: () => ({}),
  reduce: (_c, state) => state,
  isComplete: () => true,
  outcome: () => null,
};

const resolve: BrickResolver = (type) => (type === "show" ? showBrick : tapBrick);

const game: Game = parseGame({
  schemaVersion: 1,
  id: "g1",
  title: "T",
  meta: { createdAt: "2026-10-03T00:00:00Z" },
  root: {
    id: "root",
    kind: "group",
    scoring: { aggregation: "sum_points" },
    children: [
      {
        id: "s1",
        kind: "group",
        scoring: { aggregation: "sum_points" },
        children: [{ id: "b1", kind: "brick", scoring: { basePoints: 10 }, brick: { type: "tap", config: {} } }],
      },
      { id: "b2", kind: "brick", brick: { type: "show", config: {} } },
      { id: "b3", kind: "brick", scoring: { basePoints: 10 }, brick: { type: "tap", config: {} } },
    ],
  },
});

const step = (s: SessionState, ev: SessionEvent) => reduceSession(game, s, ev, { resolve });

describe("flow engine", () => {
  it("orders leaves depth-first", () => {
    expect(orderedLeaves(game.root).map((l) => l.id)).toEqual(["b1", "b2", "b3"]);
  });

  it("walks the tree, scoring leaves into a live Scorecard", () => {
    let s = initSession(game, { mode: "online" });
    expect(s.phase).toBe("lobby");

    s = step(s, { type: "START" });
    expect(s.phase).toBe("playing");
    expect(s.cursor).toBe("b1");

    s = step(s, { type: "PLAYER_INPUT", playerId: "A", input: {} });
    s = step(s, { type: "ADVANCE", source: "auto" });
    expect(s.cursor).toBe("b2");
    expect(s.results.b1.perPlayer.A).toEqual({ position: 1, points: 10 });
    expect(s.scorecard?.perPlayer.A.points).toBe(10);

    s = step(s, { type: "ADVANCE", source: "host" }); // presentational: complete, no outcome
    expect(s.cursor).toBe("b3");
    expect(s.results.b2).toBeUndefined();
    expect(s.scorecard?.perPlayer.A.points).toBe(10);

    s = step(s, { type: "PLAYER_INPUT", playerId: "A", input: {} });
    s = step(s, { type: "ADVANCE", source: "auto" });
    expect(s.phase).toBe("results");
    expect(s.cursor).toBeNull();
    expect(s.scorecard?.perPlayer.A.points).toBe(20);
  });

  it("does not advance until the current Brick is complete", () => {
    let s = initSession(game, { mode: "online" });
    s = step(s, { type: "START" });
    const before = s;
    s = step(s, { type: "ADVANCE", source: "auto" });
    expect(s).toBe(before);
    expect(s.cursor).toBe("b1");
  });

  it("tracks players joining and leaving", () => {
    let s = initSession(game, { mode: "online" });
    s = step(s, { type: "PLAYER_JOINED", playerId: "A", nickname: "Al" });
    expect(s.players.A).toEqual({ nickname: "Al", isConnected: true });
    s = step(s, { type: "PLAYER_LEFT", playerId: "A" });
    expect(s.players.A.isConnected).toBe(false);
  });

  it("state stays serializable (JSON round-trips)", () => {
    let s = initSession(game, { mode: "online" });
    s = step(s, { type: "START" });
    s = step(s, { type: "PLAYER_INPUT", playerId: "A", input: {} });
    s = step(s, { type: "ADVANCE", source: "auto" });
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});
