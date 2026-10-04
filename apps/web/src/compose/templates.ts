import { parseGame, type Game } from "@kuiz/core";

/**
 * Owner-authored starting points (authoring-model #6: template-first). A GM starts from one
 * and swaps content. Persistence for v1 anonymous authoring is localStorage (persistence
 * model #9); logged-in/DB-catalog saving comes with accounts later.
 */

/**
 * B18 Segment-Type templates, composed purely from existing Bricks (no new code):
 *  - Simple Quiz — a short mixed-format general-knowledge round.
 *  - Themed A–Z — a themed round whose answers run A, B, C… (here: world capitals A–E).
 * Both are whole-game templates for v1 (standalone, playable end-to-end); inserting them as
 * sub-games into a larger Game awaits the nested composer. See docs/spec/authoring-model.md.
 */
const TEMPLATE_GAMES: Game[] = [
  parseGame({
    schemaVersion: 1,
    id: "template-simple-quiz",
    title: "Simple Quiz",
    meta: {
      createdAt: new Date().toISOString(),
      description: "A short mixed-format quiz: select, true/false, text and multi-select.",
    },
    root: {
      id: "root",
      kind: "group",
      scoring: { aggregation: "sum_points" },
      children: [
        {
          id: "q-planet",
          kind: "brick",
          scoring: { basePoints: 10 },
          brick: {
            type: "question",
            config: {
              prompt: "Which planet is known as the Red Planet?",
              answerType: "single_select",
              options: ["Mars", "Venus", "Jupiter"],
              answer: "Mars",
            },
          },
        },
        {
          id: "q-wall",
          kind: "brick",
          scoring: { basePoints: 10 },
          brick: {
            type: "question",
            config: {
              prompt: "The Great Wall of China is visible from space with the naked eye.",
              answerType: "true_false",
              answer: false,
            },
          },
        },
        {
          id: "q-water",
          kind: "brick",
          scoring: { basePoints: 10, grading: "scaled" },
          brick: {
            type: "question",
            config: {
              prompt: "What is the chemical symbol for water?",
              answerType: "free_text",
              answer: "H2O",
              answerCheck: { strategy: "fuzzy", threshold: 0.8 },
            },
          },
        },
        {
          id: "q-primary",
          kind: "brick",
          scoring: { basePoints: 10 },
          brick: {
            type: "question",
            config: {
              prompt: "Which of these are primary colours (paint)?",
              answerType: "multiple_select",
              options: ["Red", "Green", "Blue", "Yellow"],
              answer: ["Red", "Blue", "Yellow"],
            },
          },
        },
      ],
    },
  }),
  parseGame({
    schemaVersion: 1,
    id: "template-az-capitals",
    title: "Themed A–Z: Capitals",
    meta: {
      createdAt: new Date().toISOString(),
      description: "Name the capital — the answers run A, B, C, D, E.",
    },
    root: {
      id: "root",
      kind: "group",
      scoring: { aggregation: "sum_points" },
      children: (
        [
          ["a", "Greece", "Athens"],
          ["b", "Germany", "Berlin"],
          ["c", "Egypt", "Cairo"],
          ["d", "Ireland", "Dublin"],
          ["e", "Scotland", "Edinburgh"],
        ] as const
      ).map(([letter, country, capital]) => ({
        id: `az-${letter}`,
        kind: "brick",
        scoring: { basePoints: 10, grading: "scaled" },
        brick: {
          type: "question",
          config: {
            prompt: `${letter.toUpperCase()} — Capital of ${country}?`,
            answerType: "free_text",
            answer: capital,
            answerCheck: { strategy: "fuzzy", threshold: 0.8 },
          },
        },
      })),
    },
  }),
  // B19 Blind Test: the brick-contract's canonical [play music → question] composition, built
  // from the existing play_audio + question Bricks (no new code). The audio URLs and answers
  // are placeholders a GM swaps for their own playlist. A dedicated Spotify Brick — whose
  // server handler holds the API secret (the B14 hook) — is a follow-up once a key exists.
  parseGame({
    schemaVersion: 1,
    id: "template-blind-test",
    title: "Blind Test",
    meta: {
      createdAt: new Date().toISOString(),
      description: "Play a clip, then guess the track. Swap the audio URLs for your playlist.",
    },
    root: {
      id: "root",
      kind: "group",
      scoring: { aggregation: "sum_points" },
      children: (
        [
          ["1", "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", "SoundHelix Song 1"],
          ["2", "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", "SoundHelix Song 2"],
        ] as const
      ).flatMap(([round, url, answer]) => [
        {
          id: `bt-audio-${round}`,
          kind: "brick" as const,
          brick: { type: "play_audio", config: { url } },
        },
        {
          id: `bt-q-${round}`,
          kind: "brick" as const,
          scoring: { basePoints: 10, grading: "scaled" as const, speedBonus: true },
          brick: {
            type: "question",
            config: {
              prompt: `Round ${round} — name this track`,
              answerType: "free_text",
              answer,
              answerCheck: { strategy: "fuzzy", threshold: 0.6 },
            },
          },
        },
      ]),
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
