import { useEffect, useRef, useState, type ReactNode } from "react";
import { brickRegistry } from "@kuiz/bricks";
import { orderedLeaves, type Game, type SessionEvent, type SessionState } from "@kuiz/core";
import type { Socket } from "socket.io-client";
import { connectSocket } from "./lib/socket";
import { Button, Card } from "./ui";
import { brickViews } from "./bricks/views";

interface JoinResult {
  sessionId?: string;
  code?: string;
  playerId?: string;
  hostId?: string;
  game?: Game;
  error?: string;
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-md space-y-4 p-6 text-center">{children}</div>;
}

/**
 * Online play (B11, open mode): connects to the realtime server, hosts or joins a Session,
 * and drives the lobby → play → results loop. The Game Master controls Start/Reveal/Next;
 * players answer. playerId is persisted in localStorage per code for reconnection.
 */
export function OnlineRunner({
  intent,
  code,
  nickname,
  onExit,
}: {
  intent: "host" | "join";
  code?: string;
  nickname: string;
  onExit: () => void;
}) {
  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<SessionState | null>(null);
  const [revealedAnswer, setRevealedAnswer] = useState<unknown>(undefined);
  const [game, setGame] = useState<Game | null>(null);
  const [me, setMe] = useState<{ playerId: string; hostId?: string; code?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const socket = connectSocket();
    socketRef.current = socket;

    const handleResult = (res: JoinResult): void => {
      if (res.error) {
        setError(res.error);
        return;
      }
      setMe({ playerId: res.playerId!, hostId: res.hostId, code: res.code });
      if (res.game) {
        setGame(res.game);
      }
      if (res.code && res.playerId) {
        try {
          // sessionStorage is per-tab: reconnects this tab on reload, and two tabs are two
          // players (localStorage would make a second tab reconnect as the first).
          sessionStorage.setItem(`kuiz:player:${res.code}`, res.playerId);
        } catch {
          /* storage unavailable */
        }
      }
    };

    socket.on(
      "state",
      ({ state: next, revealedAnswer: ra }: { state: SessionState; revealedAnswer?: unknown }) => {
        setState(next);
        setRevealedAnswer(ra);
      },
    );
    socket.on("connect", () => {
      if (intent === "host") {
        socket.emit("create", { nickname }, handleResult);
      } else {
        let stored: string | null = null;
        try {
          stored = code ? sessionStorage.getItem(`kuiz:player:${code}`) : null;
        } catch {
          /* ignore */
        }
        socket.emit("join", { code, nickname, playerId: stored ?? undefined }, handleResult);
      }
    });

    return () => {
      socket.close();
    };
    // Connect once on mount.
  }, []);

  const send = (event: SessionEvent): void => {
    socketRef.current?.emit("event", { event });
  };

  if (error) {
    return (
      <Centered>
        <p className="text-bad font-semibold">{error}</p>
        <Button onClick={onExit}>Back</Button>
      </Centered>
    );
  }
  if (!state || !me || !game) {
    return (
      <Centered>
        <p className="text-muted-foreground">Connecting…</p>
      </Centered>
    );
  }

  const isHost = me.hostId === me.playerId;
  const leaves = orderedLeaves(game.root);
  const index = leaves.findIndex((l) => l.id === state.cursor);
  const current = leaves[index];
  const logic = current ? brickRegistry.logic(current.brick.type) : null;
  const isRevealed = logic ? logic.isComplete(state.brickState) : false;
  const view = current ? brickViews[current.brick.type] : null;

  return (
    <div className="mx-auto max-w-xl space-y-5 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-tight">{game.title}</h1>
        {me.code && <span className="text-muted-foreground text-sm">Code {me.code}</span>}
      </header>

      {state.phase === "lobby" && (
        <Card className="space-y-4">
          <h2 className="text-lg font-semibold">Lobby</h2>
          <ul className="space-y-1">
            {Object.entries(state.players).map(([id, p]) => (
              <li key={id} className="flex items-center gap-2">
                <span className={p.isConnected ? "text-good" : "text-muted-foreground"}>●</span>
                {p.nickname}
                {id === me.playerId && <span className="text-muted-foreground"> (you)</span>}
                {id === me.hostId && <span className="text-muted-foreground"> · host</span>}
              </li>
            ))}
          </ul>
          {isHost ? (
            <Button className="w-full" onClick={() => send({ type: "START" })}>
              Start game
            </Button>
          ) : (
            <p className="text-muted-foreground">Waiting for the host to start…</p>
          )}
        </Card>
      )}

      {state.phase === "playing" && current && view && (
        <>
          <Card>
            <view.Play
              config={current.brick.config}
              state={state.brickState}
              isRevealed={isRevealed}
              revealedAnswer={revealedAnswer}
              player={me.playerId}
              onEvent={send}
            />
          </Card>
          {isHost && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                disabled={isRevealed}
                onClick={() => send({ type: "REVEAL" })}
              >
                Reveal
              </Button>
              <Button
                className="flex-1"
                disabled={!isRevealed}
                onClick={() => send({ type: "ADVANCE", source: "host" })}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {state.phase === "results" && (
        <Card>
          <h2 className="text-2xl font-bold">Results</h2>
        </Card>
      )}

      {state.scorecard && Object.keys(state.scorecard.perPlayer).length > 0 && (
        <Card>
          <h3 className="mb-3 font-semibold">Scorecard</h3>
          <ul className="space-y-2">
            {Object.entries(state.scorecard.perPlayer)
              .sort((a, b) => a[1].position - b[1].position)
              .map(([pid, r]) => (
                <li key={pid} className="flex items-center justify-between">
                  <span>
                    <span className="text-muted-foreground mr-2">#{r.position}</span>
                    {state.players[pid]?.nickname ?? pid}
                  </span>
                  <span className="font-semibold">{r.points} pts</span>
                </li>
              ))}
          </ul>
        </Card>
      )}

      <Button variant="outline" onClick={onExit}>
        Leave
      </Button>
    </div>
  );
}
