import type { Game, Segment, SessionState } from "@kuiz/core";

/**
 * Per-viewer projection (B12): the server never sends raw state. Players receive a game with
 * question answers stripped, never see other players' answers, and only learn the correct
 * answer at reveal. The host sees everything. See docs/spec/online-session.md.
 */

export interface ClientView {
  state: SessionState;
  /** The current question's correct answer — only present at reveal (so players can see it). */
  revealedAnswer?: unknown;
}

function stripSegment(seg: Segment): Segment {
  if (seg.kind === "group") {
    return { ...seg, children: seg.children.map(stripSegment) };
  }
  if (seg.brick.type !== "question") {
    return seg;
  }
  const config = { ...seg.brick.config } as Record<string, unknown>;
  delete config.answer;
  delete config.answerCheck;
  return { ...seg, brick: { ...seg.brick, config } };
}

/** The game a viewer receives: full for the host, answers stripped for players. */
export function projectGame(game: Game, isHost: boolean): Game {
  if (isHost) {
    return game;
  }
  return { ...game, root: stripSegment(game.root) };
}

function findLeaf(seg: Segment, id: string): Segment | null {
  if (seg.kind === "brick") {
    return seg.id === id ? seg : null;
  }
  for (const child of seg.children) {
    const found = findLeaf(child, id);
    if (found) {
      return found;
    }
  }
  return null;
}

/** The state a viewer receives: other players' answers redacted, answer revealed only at reveal. */
export function projectState(game: Game, state: SessionState, viewerId: string, isHost: boolean): ClientView {
  const leaf = state.cursor ? findLeaf(game.root, state.cursor) : null;
  const isQuestion = leaf?.kind === "brick" && leaf.brick.type === "question";
  if (!isQuestion) {
    return { state };
  }

  const bs = state.brickState as { phase?: string; answers?: Record<string, unknown> } | null;
  const isRevealed = bs?.phase === "revealed";

  let brickState = state.brickState;
  if (!isHost && bs?.answers) {
    // Keep only the viewer's own answer; others are hidden.
    const own = bs.answers[viewerId];
    const answers: Record<string, unknown> = {};
    if (own !== undefined) {
      answers[viewerId] = own;
    }
    brickState = { ...bs, answers };
  }

  const revealedAnswer =
    isRevealed && leaf?.kind === "brick" ? (leaf.brick.config as Record<string, unknown>).answer : undefined;

  return { state: { ...state, brickState }, revealedAnswer };
}
