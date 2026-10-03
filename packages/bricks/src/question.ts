import { z } from "zod";
import type { BrickDefinition, BrickContext, SessionEvent, BrickOutcome, PlayerFacts } from "@kuiz/core";

/**
 * The question Brick — the first real interactive Brick. Supports several answer types and
 * a pluggable answer checker (exact/fuzzy) for free text. Emits per-player facts
 * ({correct, matchScore, responseMs}); the Segment's scoring turns those into points.
 * See docs/spec/brick-contract.md.
 */

export const QuestionConfigSchema = z.object({
  prompt: z.string().min(1),
  answerType: z.enum(["single_select", "multiple_select", "true_false", "free_text"]),
  options: z.array(z.string()).optional(), // for *_select
  answer: z.union([z.string(), z.array(z.string()), z.boolean()]),
  answerCheck: z
    .object({ strategy: z.enum(["exact", "fuzzy"]), threshold: z.number().min(0).max(1).optional() })
    .optional(),
  timeLimitSec: z.number().positive().optional(),
});
export type QuestionConfig = z.infer<typeof QuestionConfigSchema>;

interface QuestionState {
  phase: "awaiting" | "revealed";
  answers: Record<string, { value: unknown; atMs: number }>;
  startedAt: number;
}

const norm = (s: unknown): string => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array<number>(n).fill(0)]);
  for (let j = 0; j <= n; j++) {d[0][j] = j;}
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[m][n];
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {return false;}
  const sb = new Set(b.map(norm));
  return a.every((x) => sb.has(norm(x)));
}

/** Check one player's answer against the question's config. */
export function checkAnswer(config: QuestionConfig, value: unknown): { correct: boolean; matchScore: number } {
  switch (config.answerType) {
    case "single_select":
    case "true_false": {
      const isMatch = norm(value) === norm(config.answer as string | boolean);
      return { correct: isMatch, matchScore: isMatch ? 1 : 0 };
    }
    case "multiple_select": {
      const isMatch = Array.isArray(value) && sameSet(value as string[], config.answer as string[]);
      return { correct: isMatch, matchScore: isMatch ? 1 : 0 };
    }
    case "free_text": {
      const strategy = config.answerCheck?.strategy ?? "exact";
      const a = norm(value);
      const b = norm(config.answer as string);
      if (strategy === "exact") {return { correct: a === b, matchScore: a === b ? 1 : 0 };}
      const score = 1 - levenshtein(a, b) / Math.max(b.length, 1);
      const threshold = config.answerCheck?.threshold ?? 0.8;
      return { correct: score >= threshold, matchScore: Math.max(0, Math.round(score * 100) / 100) };
    }
  }
}

export const questionBrick: BrickDefinition<QuestionConfig, QuestionState, SessionEvent, BrickOutcome> = {
  type: "question",
  capabilities: { interactive: true, scoring: true, needsServer: false, modes: ["online", "offline"] },
  configSchema: QuestionConfigSchema,
  logic: {
    init: (_config: QuestionConfig, ctx: BrickContext): QuestionState => ({
      phase: "awaiting",
      answers: {},
      startedAt: ctx.now,
    }),
    reduce: (config: QuestionConfig, state: QuestionState, ev: SessionEvent): QuestionState => {
      if (state.phase !== "awaiting") {return state;}
      switch (ev.type) {
        case "PLAYER_INPUT": {
          const now = ev.now ?? 0;
          return {
            ...state,
            answers: { ...state.answers, [ev.playerId]: { value: ev.input, atMs: now - state.startedAt } },
          };
        }
        case "REVEAL":
          return { ...state, phase: "revealed" };
        case "TICK": {
          if (config.timeLimitSec != null && ev.now - state.startedAt >= config.timeLimitSec * 1000) {
            return { ...state, phase: "revealed" };
          }
          return state;
        }
        default:
          return state;
      }
    },
    isComplete: (state: QuestionState): boolean => state.phase === "revealed",
    outcome: (config: QuestionConfig, state: QuestionState): BrickOutcome => {
      const perPlayer: Record<string, PlayerFacts> = {};
      for (const [pid, a] of Object.entries(state.answers)) {
        const { correct: isCorrect, matchScore } = checkAnswer(config, a.value);
        perPlayer[pid] = { correct: isCorrect, matchScore, responseMs: a.atMs };
      }
      return { perPlayer };
    },
  },
};
