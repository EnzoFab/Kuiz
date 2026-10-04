import { useState, type ReactNode } from "react";
import type { SessionEvent } from "@kuiz/core";
import { Button, Input, Checkbox, Select } from "../ui";

/**
 * Per-frontend Brick *views* (the web view map). The shared contract/logic lives in
 * @kuiz/bricks; this is the web rendering. B8 implements the Play views; B16 adds the
 * optional `Authoring` views (absent → the composer's generic schema-driven form is used)
 * plus `label`/`defaultConfig` for the composer's add-brick picker. See
 * docs/spec/design-system.md, authoring-model.md and brick-contract.md.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface BrickPlayProps {
  config: any;
  state: any;
  isRevealed: boolean;
  /** Correct answer supplied by the server at reveal (when the config's answer is hidden). */
  revealedAnswer?: unknown;
  player: string;
  onEvent: (ev: SessionEvent) => void;
}

export interface BrickAuthoringProps {
  config: any;
  onChange: (config: any) => void;
}

export interface BrickView {
  /** Human label for the composer's add-brick picker. */
  label: string;
  /** Starting config when this Brick is added in the composer. */
  defaultConfig: any;
  Play: (props: BrickPlayProps) => JSX.Element;
  /** Optional custom authoring form; absent → generic schema-driven form (authoring-model #6). */
  Authoring?: (props: BrickAuthoringProps) => JSX.Element;
}

const formatAnswer = (a: unknown): string => (Array.isArray(a) ? a.join(", ") : String(a));

function QuestionPlay({ config, state, isRevealed, revealedAnswer, player, onEvent }: BrickPlayProps) {
  const [draft, setDraft] = useState("");
  const [picks, setPicks] = useState<string[]>([]);
  const mine = state?.answers?.[player]?.value;
  const hasAnswered = mine !== undefined;
  const shownAnswer = config.answer ?? revealedAnswer; // config answer is stripped for players
  const answer = (input: unknown) =>
    onEvent({ type: "PLAYER_INPUT", playerId: player, input, now: Date.now() });

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold leading-tight">{config.prompt}</h2>

      {config.answerType === "single_select" &&
        (config.options as string[]).map((opt) => (
          <Button
            key={opt}
            variant={mine === opt ? "primary" : "outline"}
            className="w-full justify-start text-left"
            disabled={hasAnswered || isRevealed}
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
            disabled={hasAnswered || isRevealed}
            onClick={() => answer(opt === "true")}
          >
            {opt === "true" ? "True" : "False"}
          </Button>
        ))}

      {config.answerType === "multiple_select" && (
        <div className="space-y-2">
          {(config.options as string[]).map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
            >
              <Checkbox
                disabled={hasAnswered || isRevealed}
                checked={picks.includes(opt)}
                onChange={(e) =>
                  setPicks((p) => (e.target.checked ? [...p, opt] : p.filter((x) => x !== opt)))
                }
              />
              <span>{opt}</span>
            </label>
          ))}
          <Button className="w-full" disabled={hasAnswered || isRevealed} onClick={() => answer(picks)}>
            Submit
          </Button>
        </div>
      )}

      {config.answerType === "free_text" && (
        <div className="flex gap-2">
          <Input
            className="flex-1"
            placeholder="Type your answer"
            value={draft}
            disabled={hasAnswered || isRevealed}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && draft && answer(draft)}
          />
          <Button disabled={hasAnswered || isRevealed || !draft} onClick={() => answer(draft)}>
            Answer
          </Button>
        </div>
      )}

      {hasAnswered && !isRevealed && <p className="text-muted-foreground">Answer locked in ✓</p>}
      {isRevealed && <p className="text-good font-semibold">Correct answer: {formatAnswer(shownAnswer)}</p>}
    </div>
  );
}

const ANSWER_TYPES = ["single_select", "multiple_select", "true_false", "free_text"] as const;
type AnswerType = (typeof ANSWER_TYPES)[number];

/** Custom authoring for the question Brick: its `answer` shape depends on `answerType`, which
 * the generic schema-driven form can't express (brick-contract: optional Authoring override). */
function QuestionAuthoring({ config, onChange }: BrickAuthoringProps) {
  const set = (patch: Record<string, unknown>) => onChange({ ...config, ...patch });
  const options: string[] = config.options ?? [];
  const isSelect = config.answerType === "single_select" || config.answerType === "multiple_select";
  const isFuzzy = config.answerCheck?.strategy === "fuzzy";

  const changeType = (answerType: AnswerType) => {
    // Reset the answer (and options) to a valid shape for the new type.
    if (answerType === "single_select") {
      onChange({ ...config, answerType, options: options.length ? options : ["", ""], answer: "" });
    } else if (answerType === "multiple_select") {
      onChange({ ...config, answerType, options: options.length ? options : ["", ""], answer: [] });
    } else if (answerType === "true_false") {
      onChange({ prompt: config.prompt, answerType, answer: false });
    } else {
      onChange({ prompt: config.prompt, answerType, answer: "", answerCheck: { strategy: "exact" } });
    }
  };

  const setOption = (i: number, value: string) => {
    set({ options: options.map((o, idx) => (idx === i ? value : o)) });
  };
  const toggleMulti = (opt: string, isOn: boolean) => {
    const current: string[] = Array.isArray(config.answer) ? config.answer : [];
    set({ answer: isOn ? [...current, opt] : current.filter((x) => x !== opt) });
  };

  return (
    <div className="space-y-3">
      <label className="text-muted-foreground block text-sm">Prompt</label>
      <Input
        placeholder="Question prompt"
        value={config.prompt ?? ""}
        onChange={(e) => set({ prompt: e.target.value })}
      />

      <label className="text-muted-foreground block text-sm">Answer type</label>
      <Select
        value={config.answerType ?? "single_select"}
        onChange={(e) => changeType(e.target.value as AnswerType)}
      >
        {ANSWER_TYPES.map((t) => (
          <option key={t} value={t}>
            {t.replace("_", " ")}
          </option>
        ))}
      </Select>

      {isSelect && (
        <div className="space-y-2">
          <label className="text-muted-foreground block text-sm">Options</label>
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              {config.answerType === "multiple_select" ? (
                <Checkbox
                  checked={Array.isArray(config.answer) && config.answer.includes(opt)}
                  onChange={(e) => toggleMulti(opt, e.target.checked)}
                />
              ) : (
                <input
                  type="radio"
                  className="accent-primary h-5 w-5"
                  checked={config.answer === opt}
                  onChange={() => set({ answer: opt })}
                />
              )}
              <Input value={opt} onChange={(e) => setOption(i, e.target.value)} />
              <Button
                variant="outline"
                onClick={() => set({ options: options.filter((_, idx) => idx !== i) })}
              >
                ✕
              </Button>
            </div>
          ))}
          <Button variant="outline" onClick={() => set({ options: [...options, ""] })}>
            Add option
          </Button>
          <p className="text-muted-foreground text-sm">
            {config.answerType === "multiple_select"
              ? "Tick every correct option."
              : "Select the one correct option."}
          </p>
        </div>
      )}

      {config.answerType === "true_false" && (
        <>
          <label className="text-muted-foreground block text-sm">Correct answer</label>
          <Select value={String(config.answer)} onChange={(e) => set({ answer: e.target.value === "true" })}>
            <option value="true">True</option>
            <option value="false">False</option>
          </Select>
        </>
      )}

      {config.answerType === "free_text" && (
        <>
          <label className="text-muted-foreground block text-sm">Correct answer</label>
          <Input
            placeholder="Expected answer"
            value={config.answer ?? ""}
            onChange={(e) => set({ answer: e.target.value })}
          />
          <label className="text-muted-foreground block text-sm">Matching</label>
          <Select
            value={config.answerCheck?.strategy ?? "exact"}
            onChange={(e) => set({ answerCheck: { ...config.answerCheck, strategy: e.target.value } })}
          >
            <option value="exact">Exact</option>
            <option value="fuzzy">Fuzzy (typo-tolerant)</option>
          </Select>
          {isFuzzy && (
            <Input
              type="number"
              step="0.05"
              min="0"
              max="1"
              placeholder="Threshold 0–1 (default 0.8)"
              value={config.answerCheck?.threshold ?? ""}
              onChange={(e) =>
                set({
                  answerCheck: {
                    ...config.answerCheck,
                    strategy: "fuzzy",
                    threshold: e.target.value === "" ? undefined : Number(e.target.value),
                  },
                })
              }
            />
          )}
        </>
      )}

      <label className="text-muted-foreground block text-sm">Time limit (seconds, optional)</label>
      <Input
        type="number"
        min="1"
        placeholder="No limit"
        value={config.timeLimitSec ?? ""}
        onChange={(e) => set({ timeLimitSec: e.target.value === "" ? undefined : Number(e.target.value) })}
      />
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
  question: {
    label: "Question",
    defaultConfig: { prompt: "", answerType: "single_select", options: ["", ""], answer: "" },
    Play: QuestionPlay,
    Authoring: QuestionAuthoring,
  },
  display_image: {
    label: "Image",
    defaultConfig: { url: "" },
    Play: ({ config }) => (
      <Media caption={config.caption}>
        <img src={config.url} alt={config.caption ?? ""} className="w-full rounded-xl border border-border" />
      </Media>
    ),
  },
  play_audio: {
    label: "Audio",
    defaultConfig: { url: "" },
    Play: ({ config }) => (
      <Media>
        <audio src={config.url} controls autoPlay className="w-full" />
      </Media>
    ),
  },
  play_video: {
    label: "Video",
    defaultConfig: { url: "" },
    Play: ({ config }) => (
      <Media>
        <video src={config.url} controls autoPlay className="w-full rounded-xl border border-border" />
      </Media>
    ),
  },
};
/* eslint-enable @typescript-eslint/no-explicit-any */
