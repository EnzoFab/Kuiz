/**
 * @kuiz/bricks — the Brick contract registry + Brick implementations (question,
 * presentational, integrations). Pure + backend-reachable; no views.
 * See docs/spec/brick-contract.md.
 *
 * Brick implementations land from B6 onward and register into `brickRegistry`.
 */
import { CORE_VERSION } from "@kuiz/core";
import { brickRegistry } from "./registry.js";
import { questionBrick } from "./question.js";
import { presentationalBricks } from "./presentational.js";

export const BRICKS_VERSION = "0.0.0";
export const LINKED_CORE_VERSION = CORE_VERSION;

export * from "./registry.js";
export * from "./question.js";
export * from "./presentational.js";

// Register the built-in Bricks into the default shared registry.
brickRegistry.register(questionBrick);
for (const brick of presentationalBricks) brickRegistry.register(brick);
