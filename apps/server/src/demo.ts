import { parseGame, type Game } from "@kuiz/core";

/**
 * A seeded demo game so there's something to join before the catalog exists (B15/B17).
 * Throwaway; replaced by the DB-backed catalog later.
 */
export const demoGame: Game = parseGame({
  schemaVersion: 1,
  id: "demo",
  title: "Kuiz Demo",
  meta: { createdAt: new Date().toISOString() },
  root: {
    id: "root",
    kind: "group",
    scoring: { aggregation: "sum_points" },
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
            options: ["Paris", "Lyon", "Nice"],
            answer: "Paris",
          },
        },
      },
      {
        id: "q2",
        kind: "brick",
        scoring: { basePoints: 5 },
        brick: {
          type: "question",
          config: { prompt: "The Earth is flat.", answerType: "true_false", answer: false },
        },
      },
    ],
  },
});
