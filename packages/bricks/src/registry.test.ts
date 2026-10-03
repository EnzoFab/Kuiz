import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  initSession,
  reduceSession,
  parseGame,
  type BrickDefinition,
  type Game,
  type SessionEvent,
} from "@kuiz/core";
import { BrickRegistry } from "./registry.js";

// A minimal stub Brick definition: completes on PLAYER_INPUT, scores player A.
const tapBrick: BrickDefinition = {
  type: "tap",
  capabilities: { interactive: true, scoring: true, needsServer: false, modes: ["online", "offline"] },
  configSchema: z.object({}).passthrough(),
  logic: {
    init: () => ({ done: false }),
    reduce: (_c, state: { done: boolean }, ev: SessionEvent) =>
      ev.type === "PLAYER_INPUT" ? { done: true } : state,
    isComplete: (state: { done: boolean }) => state.done,
    outcome: () => ({ perPlayer: { A: { correct: true } } }),
  },
};

const game: Game = parseGame({
  schemaVersion: 1,
  id: "g",
  title: "T",
  meta: { createdAt: "2026-10-03T00:00:00Z" },
  root: {
    id: "root",
    kind: "group",
    children: [{ id: "b1", kind: "brick", scoring: { basePoints: 10 }, brick: { type: "tap", config: {} } }],
  },
});

describe("BrickRegistry", () => {
  it("registers, resolves, and reports types", () => {
    const reg = new BrickRegistry().register(tapBrick);
    expect(reg.has("tap")).toBe(true);
    expect(reg.types()).toEqual(["tap"]);
    expect(reg.get("tap").capabilities.interactive).toBe(true);
  });

  it("throws on unknown or duplicate types", () => {
    const reg = new BrickRegistry().register(tapBrick);
    expect(() => reg.get("nope")).toThrow(/Unknown brick type/);
    expect(() => reg.register(tapBrick)).toThrow(/already registered/);
  });

  it("drives the flow engine through resolver()", () => {
    const reg = new BrickRegistry().register(tapBrick);
    const deps = { resolve: reg.resolver() };
    let s = initSession(game, { mode: "online" });
    s = reduceSession(game, s, { type: "START" }, deps);
    s = reduceSession(game, s, { type: "PLAYER_INPUT", playerId: "A", input: {} }, deps);
    s = reduceSession(game, s, { type: "ADVANCE", source: "auto" }, deps);
    expect(s.phase).toBe("results");
    expect(s.scorecard?.perPlayer.A).toEqual({ position: 1, points: 10 });
  });
});
