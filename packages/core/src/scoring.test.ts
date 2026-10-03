import { describe, it, expect } from "vitest";
import { parseGame } from "./schema.js";
import {
  rank,
  scoreLeaf,
  scoreGroup,
  computeScorecard,
  type BrickOutcome,
  type SegmentResult,
} from "./scoring.js";

describe("rank", () => {
  it("is tie-aware (equal scores share a position)", () => {
    const r = rank({ A: 10, B: 6, C: 6, D: 0 });
    expect(r.perPlayer.A).toEqual({ position: 1, points: 10 });
    expect(r.perPlayer.B).toEqual({ position: 2, points: 6 });
    expect(r.perPlayer.C).toEqual({ position: 2, points: 6 });
    expect(r.perPlayer.D).toEqual({ position: 4, points: 0 });
  });
});

describe("scoreLeaf", () => {
  const outcome: BrickOutcome = {
    perPlayer: {
      A: { correct: true, matchScore: 1, responseMs: 1000 },
      B: { correct: true, matchScore: 0.9, responseMs: 500 },
      C: { correct: false, matchScore: 0.2, responseMs: 800 },
    },
  };

  it("binary: full points if correct, else 0", () => {
    const r = scoreLeaf({ basePoints: 10, grading: "binary" }, outcome);
    expect(r.perPlayer.A.points).toBe(10);
    expect(r.perPlayer.B.points).toBe(10);
    expect(r.perPlayer.C.points).toBe(0);
  });

  it("scaled: points × matchScore (fuzzy partial credit)", () => {
    const r = scoreLeaf({ basePoints: 10, grading: "scaled" }, outcome);
    expect(r.perPlayer.A.points).toBe(10);
    expect(r.perPlayer.B.points).toBe(9);
    expect(r.perPlayer.C.points).toBe(2);
  });

  it("speedBonus: +1 to the fastest scoring player", () => {
    const r = scoreLeaf({ basePoints: 10, grading: "binary", speedBonus: true }, outcome);
    expect(r.perPlayer.B.points).toBe(11); // fastest correct (500ms)
    expect(r.perPlayer.A.points).toBe(10);
    expect(r.perPlayer.B.position).toBe(1);
  });
});

describe("scoreGroup", () => {
  const seg1: SegmentResult = { perPlayer: { A: { position: 1, points: 10 }, B: { position: 2, points: 6 } } };
  const seg2: SegmentResult = { perPlayer: { A: { position: 2, points: 4 }, B: { position: 1, points: 8 } } };

  it("sum_points adds points across children", () => {
    const r = scoreGroup({ aggregation: "sum_points" }, [seg1, seg2]);
    expect(r.perPlayer.A.points).toBe(14);
    expect(r.perPlayer.B.points).toBe(14);
    expect(r.perPlayer.A.position).toBe(1);
    expect(r.perPlayer.B.position).toBe(1); // tie 14–14
  });

  it("count_wins counts #1 placements (A wins seg1, B wins seg2)", () => {
    const r = scoreGroup({ aggregation: "count_wins" }, [seg1, seg2]);
    expect(r.perPlayer.A.points).toBe(1);
    expect(r.perPlayer.B.points).toBe(1);
    expect(r.perPlayer.A.position).toBe(1);
    expect(r.perPlayer.B.position).toBe(1);
  });

  it("throws on an unknown strategy", () => {
    expect(() => scoreGroup({ aggregation: "nope" }, [seg1])).toThrow(/Unknown aggregation/);
  });
});

describe("computeScorecard", () => {
  const game = parseGame({
    schemaVersion: 1,
    id: "g",
    title: "T",
    meta: { createdAt: "2026-10-03T00:00:00Z" },
    root: {
      id: "root",
      kind: "group",
      scoring: { aggregation: "sum_points" },
      children: [
        { id: "q1", kind: "brick", scoring: { basePoints: 10 }, brick: { type: "question", config: {} } },
        { id: "q2", kind: "brick", scoring: { basePoints: 10 }, brick: { type: "question", config: {} } },
      ],
    },
  });

  it("folds leaf results up the tree (partial play is fine)", () => {
    // Only q1 answered so far: A correct, B wrong.
    const partial = { q1: scoreLeaf({ basePoints: 10 }, { perPlayer: { A: { correct: true }, B: { correct: false } } }) };
    const sc1 = computeScorecard(game, partial);
    expect(sc1.perPlayer.A).toEqual({ position: 1, points: 10 });
    expect(sc1.perPlayer.B).toEqual({ position: 2, points: 0 });
    expect(sc1.bySegment.q1).toBeDefined();
    expect(sc1.bySegment.q2).toBeUndefined();

    // Then q2: B correct, A wrong → totals A=10, B=10, tie #1.
    const full = {
      ...partial,
      q2: scoreLeaf({ basePoints: 10 }, { perPlayer: { A: { correct: false }, B: { correct: true } } }),
    };
    const sc2 = computeScorecard(game, full);
    expect(sc2.perPlayer.A.points).toBe(10);
    expect(sc2.perPlayer.B.points).toBe(10);
    expect(sc2.perPlayer.A.position).toBe(1);
    expect(sc2.perPlayer.B.position).toBe(1);
  });

  it("returns an empty Scorecard before any result", () => {
    expect(computeScorecard(game, {})).toEqual({ perPlayer: {}, bySegment: {} });
  });
});
