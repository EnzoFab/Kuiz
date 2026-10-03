import type { Game, Segment, LeafScoring, GroupScoring } from "./schema.js";

/**
 * Scoring & aggregation (v1). See docs/spec/scoring-model.md.
 *
 * Bricks emit facts; Segments own scoring. A leaf turns its Brick's facts into
 * `{position, points}`; a group aggregates its children; the Scorecard is the root result.
 */

export type PlayerId = string;

/** Raw per-player facts a scoring-bearing Brick emits (e.g. a question). */
export interface PlayerFacts {
  correct?: boolean;
  matchScore?: number; // 0..1, for graded/fuzzy checks
  responseMs?: number;
}
export interface BrickOutcome {
  perPlayer: Record<PlayerId, PlayerFacts>;
}

export interface SegmentResult {
  perPlayer: Record<PlayerId, { position: number; points: number }>;
}

export interface Scorecard {
  perPlayer: Record<PlayerId, { position: number; points: number }>;
  bySegment: Record<string, SegmentResult>;
}

/** Rank a per-player metric into tie-aware positions (equal scores share a position). */
export function rank(metric: Record<PlayerId, number>): SegmentResult {
  const rows = Object.entries(metric)
    .map(([player, points]) => ({ player, points }))
    .sort((a, b) => b.points - a.points);
  const perPlayer: SegmentResult["perPlayer"] = {};
  let position = 0;
  let prev: number | null = null;
  let seen = 0;
  for (const row of rows) {
    seen += 1;
    if (row.points !== prev) {
      position = seen;
      prev = row.points;
    }
    perPlayer[row.player] = { position, points: row.points };
  }
  return { perPlayer };
}

function applySpeedBonus(metric: Record<PlayerId, number>, outcome: BrickOutcome): void {
  let best = Infinity;
  for (const [pid, f] of Object.entries(outcome.perPlayer)) {
    if ((metric[pid] ?? 0) > 0 && f.responseMs != null) {best = Math.min(best, f.responseMs);}
  }
  if (best === Infinity) {return;}
  for (const [pid, f] of Object.entries(outcome.perPlayer)) {
    if ((metric[pid] ?? 0) > 0 && f.responseMs === best) {metric[pid] += 1;}
  }
}

/** Turn a Brick's outcome into a Segment Result using a leaf scoring rule. */
export function scoreLeaf(rule: LeafScoring, outcome: BrickOutcome): SegmentResult {
  const metric: Record<PlayerId, number> = {};
  for (const [pid, f] of Object.entries(outcome.perPlayer)) {
    if (rule.grading === "scaled") {
      const frac = f.matchScore ?? (f.correct ? 1 : 0);
      metric[pid] = Math.round(rule.basePoints * frac);
    } else {
      metric[pid] = f.correct ? rule.basePoints : 0;
    }
  }
  if (rule.speedBonus) {applySpeedBonus(metric, outcome);}
  return rank(metric);
}

/** A group aggregation strategy: children results → a per-player metric (then ranked). */
export type AggregationStrategy = (children: SegmentResult[]) => Record<PlayerId, number>;

/** Pluggable registry of aggregation strategies (new rating types drop in here). */
export const aggregations: Record<string, AggregationStrategy> = {
  sum_points: (children) => {
    const acc: Record<PlayerId, number> = {};
    for (const c of children) {
      for (const [p, r] of Object.entries(c.perPlayer)) {acc[p] = (acc[p] ?? 0) + r.points;}
    }
    return acc;
  },
  count_wins: (children) => {
    const acc: Record<PlayerId, number> = {};
    for (const c of children) {
      for (const p of Object.keys(c.perPlayer)) {acc[p] = acc[p] ?? 0;} // ensure everyone appears
      for (const [p, r] of Object.entries(c.perPlayer)) {if (r.position === 1) {acc[p] += 1;}}
    }
    return acc;
  },
};

/** Aggregate a group's children into a Segment Result via its scoring strategy. */
export function scoreGroup(scoring: GroupScoring, children: SegmentResult[]): SegmentResult {
  const strategy = aggregations[scoring.aggregation];
  if (!strategy) {throw new Error(`Unknown aggregation strategy: ${scoring.aggregation}`);}
  return rank(strategy(children));
}

/**
 * Fold the collected leaf Segment Results up the tree into the Scorecard. Tolerant of
 * partial play: Segments with no result yet are skipped, so this yields the live Scorecard
 * at any point. The root group's result is the Scorecard; `bySegment` keeps every computed
 * Segment Result for UI breakdown.
 */
export function computeScorecard(game: Game, results: Record<string, SegmentResult>): Scorecard {
  const bySegment: Record<string, SegmentResult> = {};
  const compute = (seg: Segment): SegmentResult | null => {
    if (seg.kind === "brick") {
      const r = results[seg.id];
      if (r) {bySegment[seg.id] = r;}
      return r ?? null;
    }
    const childResults: SegmentResult[] = [];
    for (const child of seg.children) {
      const r = compute(child);
      if (r) {childResults.push(r);}
    }
    if (childResults.length === 0) {return null;}
    const scoring: GroupScoring = seg.scoring ?? { aggregation: "sum_points" };
    const res = scoreGroup(scoring, childResults);
    bySegment[seg.id] = res;
    return res;
  };
  const root = compute(game.root);
  return { perPlayer: root?.perPlayer ?? {}, bySegment };
}
