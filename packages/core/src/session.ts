import type { SegmentId } from "./schema.js";
import type { SegmentResult, Scorecard } from "./scoring.js";

/** Session lifecycle phase. */
export type Phase = "lobby" | "playing" | "results";

export interface Player {
  nickname: string;
  isConnected: boolean;
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
  /** Completed leaf Segment Results, keyed by Segment id. */
  results: Record<SegmentId, SegmentResult>;
  /** The live aggregated Scorecard (folded up the tree on each completion). */
  scorecard: Scorecard | null;
}

export type SessionEvent =
  | { type: "START" }
  | { type: "PLAYER_JOINED"; playerId: string; nickname: string }
  | { type: "PLAYER_LEFT"; playerId: string }
  | { type: "PLAYER_INPUT"; playerId: string; input: unknown; now?: number }
  | { type: "TICK"; now: number }
  | { type: "REVEAL" }
  | { type: "SERVER_RESULT"; payload: unknown }
  | { type: "ADVANCE"; source: "auto" | "host" }
  | { type: "END" };
