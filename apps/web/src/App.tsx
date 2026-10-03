import { parseGame, type Game } from "@kuiz/core";
import { GameRunner } from "./GameRunner";

/**
 * B8: a hardcoded one-Segment quiz, proving the design foundation + Brick views + engine
 * are playable in the browser with a live Scorecard. Authoring/catalog come later (B16/B17).
 */
const demoGame: Game = parseGame({
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
        scoring: { basePoints: 10, grading: "scaled" },
        brick: {
          type: "question",
          config: {
            prompt: "Who painted the Mona Lisa?",
            answerType: "free_text",
            answer: "Leonardo da Vinci",
            answerCheck: { strategy: "fuzzy", threshold: 0.8 },
          },
        },
      },
      {
        id: "q3",
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

export function App() {
  return (
    <main className="min-h-screen py-6">
      <GameRunner game={demoGame} />
    </main>
  );
}
