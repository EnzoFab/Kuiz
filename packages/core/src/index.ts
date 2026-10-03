/**
 * @kuiz/core — the pure, shared domain layer.
 *
 * Holds the game-definition schema (B2), and will hold the flow engine (reduceSession),
 * session types, scoring, and the Brick contract interfaces. See docs/spec/*. No UI, no I/O.
 */
export const CORE_VERSION = "0.0.0";

export * from "./schema.js";
export * from "./brick.js";
export * from "./session.js";
export * from "./engine.js";
