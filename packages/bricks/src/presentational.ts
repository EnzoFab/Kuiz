import { z } from "zod";
import type { BrickContext, BrickDefinition, SessionEvent } from "@kuiz/core";

/**
 * Presentational (read-only) Bricks: display image, play audio/video. They present
 * something and emit no outcome, completing on a timer (if `durationSec` is set) or on a
 * host/online proceed signal (REVEAL). All share one logic; only their config/view differ.
 * See docs/spec/brick-contract.md.
 */

interface PresentationalState {
  phase: "showing" | "done";
  startedAt: number;
}

interface WithDuration {
  durationSec?: number;
}

const durationField = { durationSec: z.number().positive().optional() };

function makePresentationalBrick(type: string, configSchema: z.ZodTypeAny): BrickDefinition {
  return {
    type,
    capabilities: { interactive: false, scoring: false, needsServer: false, modes: ["online", "offline"] },
    configSchema,
    logic: {
      init: (config: WithDuration, ctx: BrickContext): PresentationalState => ({
        // With no duration the Brick is immediately done, so the host can advance freely.
        phase: config.durationSec ? "showing" : "done",
        startedAt: ctx.now,
      }),
      reduce: (config: WithDuration, state: PresentationalState, ev: SessionEvent): PresentationalState => {
        if (state.phase === "done") {
          return state;
        }
        if (ev.type === "REVEAL") {
          return { ...state, phase: "done" };
        } // host/online proceed
        if (
          ev.type === "TICK" &&
          config.durationSec != null &&
          ev.now - state.startedAt >= config.durationSec * 1000
        ) {
          return { ...state, phase: "done" };
        }
        return state;
      },
      isComplete: (state: PresentationalState): boolean => state.phase === "done",
      outcome: (): null => null,
    },
  };
}

export const DisplayImageConfigSchema = z.object({
  url: z.string().url(),
  caption: z.string().optional(),
  ...durationField,
});

export const PlayAudioConfigSchema = z.object({ url: z.string().url(), ...durationField });
export const PlayVideoConfigSchema = z.object({ url: z.string().url(), ...durationField });

export const displayImageBrick = makePresentationalBrick("display_image", DisplayImageConfigSchema);
export const playAudioBrick = makePresentationalBrick("play_audio", PlayAudioConfigSchema);
export const playVideoBrick = makePresentationalBrick("play_video", PlayVideoConfigSchema);

export const presentationalBricks: BrickDefinition[] = [displayImageBrick, playAudioBrick, playVideoBrick];
