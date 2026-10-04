import { useMemo, useState } from "react";
import { initSession, reduceSession, type Game, type SessionEvent, type SessionState } from "@kuiz/core";
import { brickRegistry } from "@kuiz/bricks";
import { Button, Card } from "./ui";
import { currentBrick } from "./lib/currentBrick";

const HOST = "host";

/**
 * Offline walkthrough runtime (B9): a single device, Game Master only. Reuses the flow
 * engine and Brick views in a host/presentation context; the GM paces it with
 * Back / Reveal / Next. No player devices and no scoring in v1 (see
 * docs/spec/offline-runtime.md). "Back" is a host-only undo over the serializable session
 * state — no engine change needed.
 */
export function OfflineRunner({ game, onExit }: { game: Game; onExit?: () => void }) {
  const deps = useMemo(() => ({ resolve: brickRegistry.resolver(), now: () => Date.now() }), []);

  const [history, setHistory] = useState<SessionState[]>(() => [
    reduceSession(game, initSession(game, { mode: "offline" }), { type: "START" }, deps),
  ]);
  const state = history[history.length - 1];
  const canGoBack = history.length > 1;

  const dispatch = (ev: SessionEvent) => {
    setHistory((h) => [...h, reduceSession(game, h[h.length - 1], ev, deps)]);
  };
  const goBack = () => {
    setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
  };

  const { leaves, index, current, isRevealed, view } = currentBrick(game, state);

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{game.title}</h1>
          <p className="text-muted-foreground text-sm">Offline walkthrough — host view</p>
        </div>
        {state.phase === "playing" && (
          <span className="text-muted-foreground text-lg font-semibold">
            {index + 1} / {leaves.length}
          </span>
        )}
      </header>

      {state.phase === "playing" && current && view && (
        <Card className="flex-1 p-8 text-lg">
          <view.Play
            config={current.brick.config}
            state={state.brickState}
            isRevealed={isRevealed}
            player={HOST}
            onEvent={dispatch}
          />
        </Card>
      )}

      {state.phase === "results" && (
        <Card className="flex-1 p-8">
          <h2 className="text-3xl font-bold">End of game</h2>
          <p className="text-muted-foreground mt-2">
            Thanks for playing. (Offline mode keeps score on paper — in-app scoring is online only for now.)
          </p>
        </Card>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onExit}>
          Exit
        </Button>
        <Button variant="outline" disabled={!canGoBack} onClick={goBack}>
          Back
        </Button>
        {state.phase === "playing" && (
          <>
            <Button
              variant="outline"
              className="flex-1"
              disabled={isRevealed}
              onClick={() => dispatch({ type: "REVEAL" })}
            >
              Reveal
            </Button>
            <Button
              className="flex-1"
              disabled={!isRevealed}
              onClick={() => dispatch({ type: "ADVANCE", source: "host" })}
            >
              Next
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
