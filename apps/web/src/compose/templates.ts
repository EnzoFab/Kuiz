import { parseGame, type Game } from "@kuiz/core";

/**
 * Owner-authored starting points (authoring-model #6: template-first). A GM starts from one
 * and swaps content. Persistence for v1 anonymous authoring is localStorage (persistence
 * model #9); logged-in/DB-catalog saving comes with accounts later.
 */

const TEMPLATE_GAMES: Game[] = [
  parseGame({
    schemaVersion: 1,
    id: "template-friday-quiz",
    title: "Friday Night Quiz",
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
      ],
    },
  }),
];

export interface Template {
  name: string;
  /** A fresh, editable copy with a new game id (so editing never mutates the preset). */
  instantiate: () => Game;
}

const blankGame = (): Game =>
  parseGame({
    schemaVersion: 1,
    id: crypto.randomUUID(),
    title: "Untitled game",
    meta: { createdAt: new Date().toISOString() },
    root: { id: "root", kind: "group", scoring: { aggregation: "sum_points" }, children: [] },
  });

export const TEMPLATES: Template[] = [
  { name: "Blank", instantiate: blankGame },
  ...TEMPLATE_GAMES.map((game) => ({
    name: game.title,
    instantiate: (): Game => ({
      ...structuredClone(game),
      id: crypto.randomUUID(),
      meta: { ...game.meta, createdAt: new Date().toISOString() },
    }),
  })),
];

// ---- localStorage draft store ------------------------------------------------------------

const STORE_KEY = "kuiz:games";

/** All saved games, newest first; tolerant of missing/blocked storage (returns []). */
export function loadGames(): Game[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, Game>) : {};
    return Object.values(map).reverse();
  } catch {
    return [];
  }
}

function writeAll(map: Record<string, Game>): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(map));
  } catch {
    // Storage unavailable (private mode / blocked) — editing still works in-memory this session.
  }
}

function readAll(): Record<string, Game> {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Game>) : {};
  } catch {
    return {};
  }
}

export function saveGame(game: Game): void {
  const map = readAll();
  map[game.id] = game;
  writeAll(map);
}

export function deleteGame(id: string): void {
  const map = readAll();
  delete map[id];
  writeAll(map);
}
