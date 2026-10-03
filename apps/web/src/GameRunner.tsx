import { useMemo, useReducer } from "react";
import {
  initSession,
  orderedLeaves,
  reduceSession,
  type Game,
  type SessionEvent,
  type SessionState,
} from "@kuiz/core";
import { brickRegistry } from "@kuiz/bricks";
import { Button, Card } from "./ui";
import { brickViews } from "./bricks/views";

const PLAYER = "You";

/**
 * A minimal single-device play harness (B8): runs the flow engine locally and renders the
 * current Brick's view, plus host controls and the live Scorecard. B9 formalizes this into
 * the offline walkthrough runtime (host view, GM pacing).
 */
export function GameRunner({ game }: { game: Game }) {
  const deps = useMemo(() => ({ resolve: brickRegistry.resolver(), now: () => Date.now() }), []);

  const [state, dispatch] = useReducer(
    (s: SessionState, ev: SessionEvent) => reduceSession(game, s, ev, deps),
    undefined,
    () => reduceSession(game, initSession(game, { mode: "offline" }), { type: "START" }, deps),
  );

  const leaves = orderedLeaves(game.root);
  const index = leaves.findIndex((l) => l.id === state.cursor);
  const current = leaves[index];
  const logic = current ? brickRegistry.logic(current.brick.type) : null;
  const isComplete = logic ? logic.isComplete(state.brickState) : false;
  const view = current ? brickViews[current.brick.type] : null;

  return (
    <div className="mx-auto max-w-xl space-y-5 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-tight">{game.title}</h1>
        {state.phase === "playing" && (
          <span className="text-muted-foreground text-sm">
            {index + 1} / {leaves.length}
          </span>
        )}
      </header>

      {state.phase === "playing" && current && view && (
        <>
          <Card>
            <view.Play
              config={current.brick.config}
              state={state.brickState}
              isRevealed={isComplete}
              player={PLAYER}
              onEvent={dispatch}
            />
          </Card>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" disabled={isComplete} onClick={() => dispatch({ type: "REVEAL" })}>
              Reveal
            </Button>
            <Button className="flex-1" disabled={!isComplete} onClick={() => dispatch({ type: "ADVANCE", source: "host" })}>
              Next
            </Button>
          </div>
        </>
      )}

      {state.phase === "results" && (
        <Card>
          <h2 className="text-2xl font-bold">Results</h2>
          <p className="text-muted-foreground mt-1">Final scorecard</p>
        </Card>
      )}

      {state.scorecard && Object.keys(state.scorecard.perPlayer).length > 0 && (
        <Card>
          <h3 className="mb-3 font-semibold">Scorecard</h3>
          <ul className="space-y-2">
            {Object.entries(state.scorecard.perPlayer)
              .sort((a, b) => a[1].position - b[1].position)
              .map(([player, r]) => (
                <li key={player} className="flex items-center justify-between">
                  <span>
                    <span className="text-muted-foreground mr-2">#{r.position}</span>
                    {player}
                  </span>
                  <span className="font-semibold">{r.points} pts</span>
                </li>
              ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
