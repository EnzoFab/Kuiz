import { describe, it, expect } from "vitest";
import { checkAnswer, questionBrick, QuestionConfigSchema, type QuestionConfig } from "./question.js";
import type { SessionEvent } from "@kuiz/core";

describe("checkAnswer", () => {
  it("single_select: exact option match", () => {
    const c: QuestionConfig = {
      prompt: "?",
      answerType: "single_select",
      options: ["Paris", "Lyon"],
      answer: "Paris",
    };
    expect(checkAnswer(c, "Paris")).toEqual({ correct: true, matchScore: 1 });
    expect(checkAnswer(c, "Lyon")).toEqual({ correct: false, matchScore: 0 });
  });

  it("multiple_select: set equality (order-independent)", () => {
    const c: QuestionConfig = { prompt: "?", answerType: "multiple_select", answer: ["a", "b"] };
    expect(checkAnswer(c, ["b", "a"]).correct).toBe(true);
    expect(checkAnswer(c, ["a"]).correct).toBe(false);
  });

  it("true_false", () => {
    const c: QuestionConfig = { prompt: "?", answerType: "true_false", answer: true };
    expect(checkAnswer(c, true).correct).toBe(true);
    expect(checkAnswer(c, false).correct).toBe(false);
  });

  it("free_text exact", () => {
    const c: QuestionConfig = { prompt: "?", answerType: "free_text", answer: "Mona Lisa" };
    expect(checkAnswer(c, "mona lisa").correct).toBe(true); // normalized
    expect(checkAnswer(c, "mona").correct).toBe(false);
  });

  it("free_text fuzzy: tolerant of spelling", () => {
    const c: QuestionConfig = {
      prompt: "?",
      answerType: "free_text",
      answer: "Leonardo da Vinci",
      answerCheck: { strategy: "fuzzy", threshold: 0.8 },
    };
    expect(checkAnswer(c, "Leonrado da Vinci").correct).toBe(true); // transposition
    expect(checkAnswer(c, "Picasso").correct).toBe(false);
  });
});

describe("questionBrick logic", () => {
  const config: QuestionConfig = {
    prompt: "Capital of France?",
    answerType: "single_select",
    options: ["Paris", "Lyon"],
    answer: "Paris",
    timeLimitSec: 20,
  };
  const L = questionBrick.logic;

  it("records answers, reveals, and emits facts with response time", () => {
    let s = L.init(config, { now: 1000 });
    s = L.reduce(config, s, { type: "PLAYER_INPUT", playerId: "A", input: "Paris", now: 3000 });
    s = L.reduce(config, s, { type: "PLAYER_INPUT", playerId: "B", input: "Lyon", now: 4000 });
    expect(L.isComplete(s)).toBe(false);
    s = L.reduce(config, s, { type: "REVEAL" } as SessionEvent);
    expect(L.isComplete(s)).toBe(true);
    const out = L.outcome(config, s)!;
    expect(out.perPlayer.A).toEqual({ correct: true, matchScore: 1, responseMs: 2000 });
    expect(out.perPlayer.B.correct).toBe(false);
  });

  it("auto-reveals on timeout via TICK", () => {
    let s = L.init(config, { now: 0 });
    s = L.reduce(config, s, { type: "TICK", now: 19_000 });
    expect(L.isComplete(s)).toBe(false);
    s = L.reduce(config, s, { type: "TICK", now: 20_000 });
    expect(L.isComplete(s)).toBe(true);
  });

  it("ignores answers after reveal", () => {
    let s = L.init(config, { now: 0 });
    s = L.reduce(config, s, { type: "REVEAL" } as SessionEvent);
    s = L.reduce(config, s, { type: "PLAYER_INPUT", playerId: "A", input: "Paris", now: 100 });
    expect(Object.keys(s.answers)).toHaveLength(0);
  });

  it("has a valid, parseable config schema", () => {
    expect(QuestionConfigSchema.safeParse(config).success).toBe(true);
    expect(QuestionConfigSchema.safeParse({ prompt: "", answerType: "nope", answer: 1 }).success).toBe(false);
  });
});
