import type { SegmentId } from "./schema.js";

/** Session lifecycle phase. */
export type Phase = "lobby" | "playing" | "results";

export interface Player {
  nickname: string;
  connected: boolean;
}

/**
 * The whole runtime state of a Session — fully serializable (it is the value held in the
 * realtime in-memory store; a reconnecting player receives this snapshot). See
 * docs/spec/flow-execution-model.md.
 *
 * B3 collects each leaf's raw `outcome` into `results`; folding those into a `scorecard`
 * is B4 (scoring), so `scorecard` stays null here.
 */
export interface SessionState {
  gameId: string;
  mode: "online" | "offline";
  phase: Phase;
  players: Record<string, Player>;
  /** The current leaf Segment's id (v1 linear). null before START / after the last leaf. */
  cursor: SegmentId | null;
  /** The current Brick's reducer state. */
  brickState: unknown;
  /** Completed leaf outcomes, keyed by Segment id. Scoring fold → B4. */
  results: Record<SegmentId, unknown>;
  /** The aggregated Scorecard — computed in B4. */
  scorecard: unknown | null;
}

export type SessionEvent =
  | { type: "START" }
  | { type: "PLAYER_JOINED"; playerId: string; nickname: string }
  | { type: "PLAYER_LEFT"; playerId: string }
  | { type: "PLAYER_INPUT"; playerId: string; input: unknown }
  | { type: "TICK"; now: number }
  | { type: "SERVER_RESULT"; payload: unknown }
  | { type: "ADVANCE"; source: "auto" | "host" }
  | { type: "END" };
