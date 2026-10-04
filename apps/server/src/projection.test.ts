import { describe, it, expect } from "vitest";
import { parseGame, type SessionState } from "@kuiz/core";
import { projectGame, projectState } from "./projection.js";

const game = parseGame({
  schemaVersion: 1,
  id: "g",
  title: "T",
  meta: { createdAt: "2026-10-04T00:00:00Z" },
  root: {
    id: "root",
    kind: "group",
    children: [
      {
        id: "q1",
        kind: "brick",
        scoring: { basePoints: 10 },
        brick: {
          type: "question",
          config: {
            prompt: "Capital of France?",
            answerType: "single_select",
            options: ["Paris", "Lyon"],
            answer: "Paris",
            answerCheck: { strategy: "exact" },
          },
        },
      },
    ],
  },
});

function stateWith(phase: "awaiting" | "revealed", answers: Record<string, unknown>): SessionState {
  return {
    gameId: "g",
    mode: "online",
    phase: "playing",
    players: {},
    cursor: "q1",
    brickState: { phase, answers, startedAt: 0 },
    results: {},
    scorecard: null,
  };
}

describe("projectGame", () => {
  it("strips question answers for players, keeps options", () => {
    const leaf = projectGame(game, false).root;
    const config = (leaf.kind === "group" &&
      leaf.children[0].kind === "brick" &&
      leaf.children[0].brick.config) as Record<string, unknown>;
    expect(config.answer).toBeUndefined();
    expect(config.answerCheck).toBeUndefined();
    expect(config.options).toEqual(["Paris", "Lyon"]);
  });

  it("keeps answers for the host", () => {
    const root = projectGame(game, true).root;
    const config = (root.kind === "group" &&
      root.children[0].kind === "brick" &&
      root.children[0].brick.config) as Record<string, unknown>;
    expect(config.answer).toBe("Paris");
  });
});

describe("projectState", () => {
  it("hides other players' answers from a player", () => {
    const view = projectState(
      game,
      stateWith("awaiting", { A: { value: "Paris" }, B: { value: "Lyon" } }),
      "A",
      false,
    );
    const answers = (view.state.brickState as { answers: Record<string, unknown> }).answers;
    expect(answers.A).toBeDefined();
    expect(answers.B).toBeUndefined();
    expect(view.revealedAnswer).toBeUndefined();
  });

  it("reveals the correct answer at reveal", () => {
    const view = projectState(game, stateWith("revealed", { A: { value: "Paris" } }), "A", false);
    expect(view.revealedAnswer).toBe("Paris");
  });

  it("host keeps all answers and gets the answer", () => {
    const view = projectState(
      game,
      stateWith("revealed", { A: { value: "Paris" }, B: { value: "Lyon" } }),
      "host",
      true,
    );
    const answers = (view.state.brickState as { answers: Record<string, unknown> }).answers;
    expect(answers.B).toBeDefined();
    expect(view.revealedAnswer).toBe("Paris");
  });
});
