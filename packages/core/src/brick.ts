/**
 * The Brick contract — the extensibility seam. A Brick's logic (pure reducer) and
 * contract live in the shared layer; views are per-frontend; the concrete registry lives
 * in @kuiz/bricks. See docs/spec/brick-contract.md.
 */
import type { z } from "zod";

export interface BrickContext {
  /** Server clock, injected by the runtime shell (the reducer never reads the clock). */
  now: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface BrickLogic<Config = any, State = any, Event = any, Outcome = any> {
  init(config: Config, ctx: BrickContext): State;
  reduce(config: Config, state: State, event: Event): State;
  isComplete(state: State): boolean;
  /** Per-player raw facts, or null for presentational Bricks. */
  outcome(config: Config, state: State): Outcome | null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Resolves a Brick's logic by its `type` (the real registry is provided by @kuiz/bricks). */
export type BrickResolver = (type: string) => BrickLogic;

export type SessionMode = "online" | "offline";

/** What a Brick can do — drives authoring UI, mode filtering, and runtime wiring. */
export interface BrickCapabilities {
  /** Collects player input and emits an outcome (e.g. a question). */
  interactive: boolean;
  /** Its outcome contributes to Segment scoring. */
  scoring: boolean;
  /** Requires the server handler (effects/secrets/AI). */
  needsServer: boolean;
  /** Session modes it supports; a Brick with only ["online"] is filtered out offline. */
  modes: SessionMode[];
}

/** Optional impure side of a Brick (integrations/secrets/AI); result re-enters `reduce`. */
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface BrickServerHandler<Config = any, Event = any> {
  resolve(config: Config, request: unknown): Promise<Event>;
}

/**
 * The full module bundle registered per Brick type (shared side). `configSchema` is the
 * machine-readable (Zod) schema driving the authoring form, MCP validation, and runtime
 * checks. Views are registered separately, per frontend.
 */
export interface BrickDefinition<Config = any, State = any, Event = any, Outcome = any> {
  type: string;
  capabilities: BrickCapabilities;
  logic: BrickLogic<Config, State, Event, Outcome>;
  configSchema?: z.ZodTypeAny;
  server?: BrickServerHandler<Config, Event>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
