import { describe, it, expect } from "vitest";
import { parseGame, safeParseGame } from "./schema.js";

// A valid v1 Game: a Blind Test group (presentational + question) and a Simple Quiz group.
// Points live on the leaf Segments' scoring (per docs/spec/scoring-model.md), not in brick config.
const example = {
  schemaVersion: 1,
  id: "game_fridaynight",
  title: "Friday Night Quiz",
  meta: { authorNickname: "M", createdAt: "2026-10-03T20:00:00Z" },
  root: {
    id: "seg_root",
    kind: "group",
    scoring: { aggregation: "sum_points" },
    children: [
      {
        id: "seg_blindtest",
        kind: "group",
        scoring: { aggregation: "sum_points" },
        children: [
          { id: "brk_music", kind: "brick", brick: { type: "spotify", config: { playlistId: "pl_90s" } } },
          {
            id: "brk_q1",
            kind: "brick",
            scoring: { basePoints: 10, grading: "scaled" },
            brick: {
              type: "question",
              config: { answerType: "free_text", prompt: "Name the song", answer: "…" },
            },
          },
        ],
      },
      {
        id: "seg_simplequiz",
        kind: "group",
        scoring: { aggregation: "count_wins" },
        children: [
          {
            id: "brk_q2",
            kind: "brick",
            scoring: { basePoints: 5 },
            brick: {
              type: "question",
              config: {
                answerType: "single_select",
                prompt: "Capital of France?",
                options: ["Paris", "Lyon"],
                answer: "Paris",
              },
            },
          },
        ],
      },
    ],
  },
} as const;

describe("game-definition schema", () => {
  it("parses a valid v1 Game", () => {
    const game = parseGame(example);
    expect(game.id).toBe("game_fridaynight");
    expect(game.root.kind).toBe("group");
  });

  it("applies the grading default (binary) on leaf scoring", () => {
    const game = parseGame(example);
    const simple = game.root.kind === "group" ? game.root.children[1] : undefined;
    const leaf = simple && simple.kind === "group" ? simple.children[0] : undefined;
    expect(leaf?.kind).toBe("brick");
    if (leaf?.kind === "brick") {
      expect(leaf.scoring?.grading).toBe("binary");
    }
  });

  it("round-trips through JSON", () => {
    const game = parseGame(example);
    const again = parseGame(JSON.parse(JSON.stringify(game)));
    expect(again).toEqual(game);
  });

  it("rejects a wrong schemaVersion", () => {
    const bad = { ...example, schemaVersion: 2 };
    expect(safeParseGame(bad).success).toBe(false);
  });

  it("rejects a Segment with an unknown kind", () => {
    const bad = { ...example, root: { id: "x", kind: "mystery", children: [] } };
    expect(safeParseGame(bad).success).toBe(false);
  });

  it("rejects a brick Segment missing its brick ref", () => {
    const bad: unknown = {
      ...example,
      root: { id: "r", kind: "group", children: [{ id: "b", kind: "brick" }] },
    };
    expect(safeParseGame(bad).success).toBe(false);
  });
});
