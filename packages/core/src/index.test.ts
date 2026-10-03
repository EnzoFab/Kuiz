import { describe, it, expect } from "vitest";
import { CORE_VERSION } from "./index.js";

describe("@kuiz/core", () => {
  it("exposes a version", () => {
    expect(CORE_VERSION).toBe("0.0.0");
  });
});
