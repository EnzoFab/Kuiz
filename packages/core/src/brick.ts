/**
 * Minimal Brick-logic interface the flow engine delegates to. The full Brick contract
 * (capabilities, server handler, views, registry) lands in B5 — see
 * docs/spec/brick-contract.md. Here core defines only what the engine needs to drive a
 * Brick, and takes the resolver as a dependency so the engine stays pure/testable.
 */

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
