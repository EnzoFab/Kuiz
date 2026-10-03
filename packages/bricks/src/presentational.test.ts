import { describe, it, expect } from "vitest";
import { displayImageBrick, playAudioBrick, DisplayImageConfigSchema } from "./presentational.js";
import type { SessionEvent } from "@kuiz/core";

describe("presentational bricks", () => {
  it("has read-only capabilities and no outcome", () => {
    expect(displayImageBrick.capabilities).toEqual({
      interactive: false,
      scoring: false,
      needsServer: false,
      modes: ["online", "offline"],
    });
    const L = displayImageBrick.logic;
    const s = L.init({ url: "https://x/y.png" }, { now: 0 });
    expect(L.outcome({ url: "https://x/y.png" }, s)).toBeNull();
  });

  it("with no duration is complete immediately (host paces it)", () => {
    const L = displayImageBrick.logic;
    const s = L.init({ url: "https://x/y.png" }, { now: 0 });
    expect(L.isComplete(s)).toBe(true);
  });

  it("with a duration completes on timeout via TICK", () => {
    const L = playAudioBrick.logic;
    const config = { url: "https://x/clip.mp3", durationSec: 30 };
    let s = L.init(config, { now: 0 });
    expect(L.isComplete(s)).toBe(false);
    s = L.reduce(config, s, { type: "TICK", now: 29_000 });
    expect(L.isComplete(s)).toBe(false);
    s = L.reduce(config, s, { type: "TICK", now: 30_000 });
    expect(L.isComplete(s)).toBe(true);
  });

  it("can be force-completed early by REVEAL (host skip)", () => {
    const L = playAudioBrick.logic;
    const config = { url: "https://x/clip.mp3", durationSec: 30 };
    let s = L.init(config, { now: 0 });
    s = L.reduce(config, s, { type: "REVEAL" } as SessionEvent);
    expect(L.isComplete(s)).toBe(true);
  });

  it("validates its config schema (url required)", () => {
    expect(DisplayImageConfigSchema.safeParse({ url: "https://x/y.png", caption: "hi" }).success).toBe(true);
    expect(DisplayImageConfigSchema.safeParse({ url: "not-a-url" }).success).toBe(false);
  });
});
