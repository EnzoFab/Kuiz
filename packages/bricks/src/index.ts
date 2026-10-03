/**
 * @kuiz/bricks — the Brick contract registry + Brick implementations (question,
 * presentational, integrations). Pure + backend-reachable; no views.
 * See docs/spec/brick-contract.md.
 *
 * Brick implementations land from B6 onward and register into `brickRegistry`.
 */
import { CORE_VERSION } from "@kuiz/core";

export const BRICKS_VERSION = "0.0.0";
export const LINKED_CORE_VERSION = CORE_VERSION;

export * from "./registry.js";
