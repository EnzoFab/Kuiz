import { z } from "zod";

/**
 * Game-definition schema (v1). See docs/spec/game-definition-schema.md and
 * docs/spec/scoring-model.md.
 *
 * A Game is a self-contained, portable JSON document: a recursive composite of
 * Segments. A Segment is either a `group` (ordered children) or a `brick` (a leaf
 * wrapping one Brick). Scoring lives on the Segment — a `LeafScoring` on leaves, a
 * `GroupScoring` on groups. `brick.config` is opaque here; each Brick validates its own
 * config (B5+).
 */

export const SegmentIdSchema = z.string().min(1);
export type SegmentId = z.infer<typeof SegmentIdSchema>;

/** Scoring rule for a leaf Segment: how a Brick's outcome becomes points. */
export const LeafScoringSchema = z.object({
  basePoints: z.number(),
  grading: z.enum(["binary", "scaled"]).default("binary"),
  speedBonus: z.boolean().optional(),
});
export type LeafScoring = z.infer<typeof LeafScoringSchema>;

/** Scoring rule for a group Segment: how children's results combine. */
export const GroupScoringSchema = z.object({
  // Open string so new strategies register without a schema change (e.g. "sum_points",
  // "count_wins", later "best_positions"/"weighted"). See docs/spec/scoring-model.md.
  aggregation: z.string().min(1),
});
export type GroupScoring = z.infer<typeof GroupScoringSchema>;

/** A reference to a Brick instance: its type + opaque, Brick-owned config. */
export const BrickRefSchema = z.object({
  type: z.string().min(1),
  config: z.record(z.unknown()).default({}),
});
export type BrickRef = z.infer<typeof BrickRefSchema>;

/** A Segment node: a group of child Segments, or a leaf wrapping one Brick. */
export type Segment =
  | { id: SegmentId; kind: "group"; scoring?: GroupScoring; children: Segment[] }
  | { id: SegmentId; kind: "brick"; scoring?: LeafScoring; brick: BrickRef };

export const SegmentSchema: z.ZodType<Segment, z.ZodTypeDef, unknown> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.object({
      id: SegmentIdSchema,
      kind: z.literal("group"),
      scoring: GroupScoringSchema.optional(),
      children: z.array(SegmentSchema),
    }),
    z.object({
      id: SegmentIdSchema,
      kind: z.literal("brick"),
      scoring: LeafScoringSchema.optional(),
      brick: BrickRefSchema,
    }),
  ]),
);

export const GameMetaSchema = z.object({
  description: z.string().optional(),
  authorNickname: z.string().optional(),
  createdAt: z.string(),
});
export type GameMeta = z.infer<typeof GameMetaSchema>;

/** The whole Game document. */
export const GameSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  title: z.string(),
  meta: GameMetaSchema,
  root: SegmentSchema,
});
export type Game = z.infer<typeof GameSchema>;

/** Parse + validate a Game, throwing on invalid input. */
export function parseGame(input: unknown): Game {
  return GameSchema.parse(input);
}

/** Parse + validate a Game, returning a zod SafeParseReturn (no throw). */
export function safeParseGame(input: unknown): z.SafeParseReturnType<unknown, Game> {
  return GameSchema.safeParse(input);
}
