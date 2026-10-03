import { useState, type ReactNode } from "react";
import type { SessionEvent } from "@kuiz/core";
import { Button } from "../ui/primitives";

/**
 * Per-frontend Brick *views* (the web view map). The shared contract/logic lives in
 * @kuiz/bricks; this is the web rendering. B8 implements the Play views; Authoring views
 * come with B16. See docs/spec/design-system.md and brick-contract.md.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface BrickPlayProps {
  config: any;
  state: any;
  revealed: boolean;
  player: string;
  onEvent: (ev: SessionEvent) => void;
}

export interface BrickView {
  Play: (props: BrickPlayProps) => JSX.Element;
}

const now = () => Date.now();

function QuestionPlay({ config, state, revealed, player, onEvent }: BrickPlayProps) {
  const [draft, setDraft] = useState("");
  const [picks, setPicks] = useState<string[]>([]);
  const mine = state?.answers?.[player]?.value;
  const answered = mine !== undefined;
  const answer = (input: unknown) => onEvent({ type: "PLAYER_INPUT", playerId: player, input, now: now() });

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold leading-tight">{config.prompt}</h2>

      {config.answerType === "single_select" &&
        (config.options as string[]).map((opt) => (
          <Button
            key={opt}
            variant={mine === opt ? "primary" : "outline"}
            className="w-full justify-start text-left"
            disabled={answered || revealed}
            onClick={() => answer(opt)}
          >
            {opt}
          </Button>
        ))}

      {config.answerType === "true_false" &&
        ["true", "false"].map((opt) => (
          <Button
            key={opt}
            variant={String(mine) === opt ? "primary" : "outline"}
            className="w-full"
            disabled={answered || revealed}
            onClick={() => answer(opt === "true")}
          >
            {opt === "true" ? "True" : "False"}
          </Button>
        ))}

      {config.answerType === "multiple_select" && (
        <div className="space-y-2">
          {(config.options as string[]).map((opt) => (
            <label key={opt} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <input
                type="checkbox"
                className="h-5 w-5"
                disabled={answered || revealed}
                checked={picks.includes(opt)}
                onChange={(e) => setPicks((p) => (e.target.checked ? [...p, opt] : p.filter((x) => x !== opt)))}
              />
              <span>{opt}</span>
            </label>
          ))}
          <Button className="w-full" disabled={answered || revealed} onClick={() => answer(picks)}>
            Submit
          </Button>
        </div>
      )}

      {config.answerType === "free_text" && (
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-base"
            placeholder="Type your answer"
            value={draft}
            disabled={answered || revealed}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && draft && answer(draft)}
          />
          <Button disabled={answered || revealed || !draft} onClick={() => answer(draft)}>
            Answer
          </Button>
        </div>
      )}

      {answered && !revealed && <p className="text-muted-foreground">Answer locked in ✓</p>}
      {revealed && (
        <p className="text-good font-semibold">
          Correct answer: {Array.isArray(config.answer) ? config.answer.join(", ") : String(config.answer)}
        </p>
      )}
    </div>
  );
}

function Media({ children, caption }: { children: ReactNode; caption?: string }) {
  return (
    <div className="space-y-3">
      {children}
      {caption && <p className="text-muted-foreground">{caption}</p>}
    </div>
  );
}

export const brickViews: Record<string, BrickView> = {
  question: { Play: QuestionPlay },
  display_image: {
    Play: ({ config }) => (
      <Media caption={config.caption}>
        <img src={config.url} alt={config.caption ?? ""} className="w-full rounded-xl border border-border" />
      </Media>
    ),
  },
  play_audio: {
    Play: ({ config }) => (
      <Media>
        <audio src={config.url} controls autoPlay className="w-full" />
      </Media>
    ),
  },
  play_video: {
    Play: ({ config }) => (
      <Media>
        <video src={config.url} controls autoPlay className="w-full rounded-xl border border-border" />
      </Media>
    ),
  },
};
/* eslint-enable @typescript-eslint/no-explicit-any */
