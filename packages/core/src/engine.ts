import type { Game, Segment } from "./schema.js";
import type { BrickResolver } from "./brick.js";
import type { SessionState, SessionEvent } from "./session.js";
import { computeScorecard, scoreLeaf, type BrickOutcome } from "./scoring.js";

type LeafSegment = Extract<Segment, { kind: "brick" }>;

/** Depth-first, child-order list of the leaf (brick) Segments — the v1 linear play order. */
export function orderedLeaves(root: Segment): LeafSegment[] {
  const out: LeafSegment[] = [];
  const walk = (s: Segment): void => {
    if (s.kind === "brick") out.push(s);
    else s.children.forEach(walk);
  };
  walk(root);
  return out;
}

export interface EngineDeps {
  /** Resolves a Brick's logic by type (provided by @kuiz/bricks at runtime). */
  resolve: BrickResolver;
  /** Server clock; defaults to 0 so the reducer is deterministic in tests. */
  now?: () => number;
}

/** A fresh Session in the lobby, before START. */
export function initSession(game: Game, opts: { mode: "online" | "offline" }): SessionState {
  return {
    gameId: game.id,
    mode: opts.mode,
    phase: "lobby",
    players: {},
    cursor: null,
    brickState: null,
    results: {},
    scorecard: null,
  };
}

/**
 * The pure session reducer. Walks the Game's leaf Segments in order, delegating
 * Brick-level events to the current Brick's logic; on ADVANCE (once the Brick is
 * complete) it stores the Brick's outcome and moves the cursor. See
 * docs/spec/flow-execution-model.md.
 */
export function reduceSession(
  game: Game,
  s: SessionState,
  ev: SessionEvent,
  deps: EngineDeps,
): SessionState {
  const now = deps.now?.() ?? 0;

  switch (ev.type) {
    case "PLAYER_JOINED":
      return { ...s, players: { ...s.players, [ev.playerId]: { nickname: ev.nickname, connected: true } } };

    case "PLAYER_LEFT": {
      const p = s.players[ev.playerId];
      return p ? { ...s, players: { ...s.players, [ev.playerId]: { ...p, connected: false } } } : s;
    }

    case "START": {
      if (s.phase !== "lobby") return s;
      const leaves = orderedLeaves(game.root);
      const first = leaves[0];
      if (!first) return { ...s, phase: "results" };
      const logic = deps.resolve(first.brick.type);
      return { ...s, phase: "playing", cursor: first.id, brickState: logic.init(first.brick.config, { now }) };
    }

    case "ADVANCE": {
      if (s.phase !== "playing" || s.cursor === null) return s;
      const leaves = orderedLeaves(game.root);
      const idx = leaves.findIndex((l) => l.id === s.cursor);
      const cur = leaves[idx];
      if (!cur) return s;
      const logic = deps.resolve(cur.brick.type);
      if (!logic.isComplete(s.brickState)) return s; // can't advance until the Brick is done
      const out = logic.outcome(cur.brick.config, s.brickState);
      // A scoring-bearing leaf (has a LeafScoring rule and emitted facts) folds into results.
      const results =
        out !== null && cur.scoring
          ? { ...s.results, [cur.id]: scoreLeaf(cur.scoring, out as BrickOutcome) }
          : s.results;
      const scorecard = computeScorecard(game, results);
      const next = leaves[idx + 1];
      if (!next) return { ...s, results, scorecard, phase: "results", cursor: null, brickState: null };
      const nextLogic = deps.resolve(next.brick.type);
      return { ...s, results, scorecard, cursor: next.id, brickState: nextLogic.init(next.brick.config, { now }) };
    }

    case "PLAYER_INPUT":
    case "TICK":
    case "SERVER_RESULT": {
      if (s.phase !== "playing" || s.cursor === null) return s;
      const cur = orderedLeaves(game.root).find((l) => l.id === s.cursor);
      if (!cur) return s;
      const logic = deps.resolve(cur.brick.type);
      // The session event is passed through as the Brick event; precise mapping
      // (e.g. PLAYER_INPUT → an answer) is the Brick's / online layer's concern (B6/B11).
      return { ...s, brickState: logic.reduce(cur.brick.config, s.brickState, ev) };
    }

    case "END":
      return { ...s, phase: "results" };

    default:
      return s;
  }
}
