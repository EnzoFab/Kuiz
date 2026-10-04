import { orderedLeaves, type Game, type Segment, type SessionState } from "@kuiz/core";
import { brickRegistry } from "@kuiz/bricks";
import { brickViews, type BrickView } from "../bricks/views";

/**
 * Derives the current leaf Brick (and its view / completeness) from (game, state) — the one
 * bit all three runners (device, offline, online) share. Keeps that derivation in one place.
 */

type LeafSegment = Extract<Segment, { kind: "brick" }>;

export interface CurrentBrick {
  leaves: LeafSegment[];
  /** Index of the current leaf in play order, or -1 before START / after the last leaf. */
  index: number;
  current: LeafSegment | undefined;
  /** True once the current Brick has reached its terminal (revealed) state. */
  isRevealed: boolean;
  /** The web view for the current Brick, or null (no current leaf / no registered view). */
  view: BrickView | null;
}

export function currentBrick(game: Game, state: SessionState): CurrentBrick {
  const leaves = orderedLeaves(game.root);
  const index = leaves.findIndex((l) => l.id === state.cursor);
  const current = leaves[index];
  const logic = current ? brickRegistry.logic(current.brick.type) : null;
  const isRevealed = logic ? logic.isComplete(state.brickState) : false;
  const view = current ? (brickViews[current.brick.type] ?? null) : null;
  return { leaves, index, current, isRevealed, view };
}
