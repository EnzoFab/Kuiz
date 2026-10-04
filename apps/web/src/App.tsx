import { useState } from "react";
import { parseGame, type Game } from "@kuiz/core";
import { GameRunner } from "./GameRunner";
import { OfflineRunner } from "./OfflineRunner";
import { OnlineRunner } from "./OnlineRunner";
import { Composer } from "./compose/Composer";
import { Catalog } from "./catalog/Catalog";
import { Button, Card, Input } from "./ui";

/**
 * Hardcoded demo game + a mode switch between the device-play harness (B8) and the offline
 * walkthrough (B9). Authoring/catalog replace this hardcoded game later (B16/B17).
 */
const demoGame: Game = parseGame({
  schemaVersion: 1,
  id: "demo",
  title: "Kuiz Demo",
  meta: { createdAt: new Date().toISOString() },
  root: {
    id: "root",
    kind: "group",
    scoring: { aggregation: "sum_points" },
    children: [
      {
        id: "q1",
        kind: "brick",
        scoring: { basePoints: 10 },
        brick: {
          type: "question",
          config: {
            prompt: "Capital of France?",
            answerType: "single_select",
            options: ["Paris", "Lyon", "Nice"],
            answer: "Paris",
          },
        },
      },
      {
        id: "q2",
        kind: "brick",
        scoring: { basePoints: 10, grading: "scaled" },
        brick: {
          type: "question",
          config: {
            prompt: "Who painted the Mona Lisa?",
            answerType: "free_text",
            answer: "Leonardo da Vinci",
            answerCheck: { strategy: "fuzzy", threshold: 0.8 },
          },
        },
      },
      {
        id: "q3",
        kind: "brick",
        scoring: { basePoints: 5 },
        brick: {
          type: "question",
          config: { prompt: "The Earth is flat.", answerType: "true_false", answer: false },
        },
      },
    ],
  },
});

type Mode = "menu" | "play" | "offline" | "online-setup" | "online" | "compose" | "catalog";

export function App() {
  const [mode, setMode] = useState<Mode>("menu");
  // The Game selected to play, in any mode — set by the catalog/composer; defaults to the demo.
  const [selectedGame, setSelectedGame] = useState<Game>(demoGame);
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState("");
  const [rosterText, setRosterText] = useState("");
  const [intent, setIntent] = useState<"host" | "join" | "watch">("host");
  const [isPrivateHost, setIsPrivateHost] = useState(false);

  const roster = rosterText
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);

  const toMenu = () => setMode("menu");

  return (
    <main className="min-h-screen py-6">
      {mode === "menu" && (
        <div className="mx-auto max-w-xl space-y-5 p-4">
          <h1 className="text-3xl font-extrabold tracking-tight">{demoGame.title}</h1>
          <Card className="space-y-3">
            <p className="text-muted-foreground">Choose how to run this game.</p>
            <Button className="w-full" onClick={() => setMode("catalog")}>
              Browse catalog
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setMode("online-setup")}>
              Play online (demo)
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setMode("play")}>
              Play on this device (demo)
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setMode("offline")}>
              Offline walkthrough (demo)
            </Button>
            <div className="border-border my-1 border-t" />
            <Button variant="outline" className="w-full" onClick={() => setMode("compose")}>
              Create / edit games
            </Button>
          </Card>
        </div>
      )}

      {mode === "online-setup" && (
        <div className="mx-auto max-w-md space-y-4 p-4">
          <h1 className="text-2xl font-extrabold tracking-tight">Play online</h1>
          <Card className="space-y-3">
            <Input
              placeholder="Your nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
            <Button
              className="w-full"
              disabled={!nickname}
              onClick={() => {
                setIntent("host");
                setIsPrivateHost(false);
                setMode("online");
              }}
            >
              Host a new game
            </Button>
            <div className="border-border my-1 border-t" />
            <Input
              placeholder="Join code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <Button
              variant="outline"
              className="w-full"
              disabled={!nickname || !code}
              onClick={() => {
                setIntent("join");
                setMode("online");
              }}
            >
              Join with code
            </Button>
            <Button
              variant="outline"
              className="w-full"
              disabled={!code}
              onClick={() => {
                setIntent("watch");
                setMode("online");
              }}
            >
              Join private game (pick a player)
            </Button>
            <div className="border-border my-1 border-t" />
            <Input
              placeholder="Private roster: Alice, Bob, Chloé"
              value={rosterText}
              onChange={(e) => setRosterText(e.target.value)}
            />
            <Button
              variant="outline"
              className="w-full"
              disabled={!nickname || roster.length === 0}
              onClick={() => {
                setIntent("host");
                setIsPrivateHost(true);
                setMode("online");
              }}
            >
              Host private game
            </Button>
            <Button variant="outline" className="w-full" onClick={toMenu}>
              Back
            </Button>
          </Card>
        </div>
      )}

      {mode === "play" && <GameRunner game={selectedGame} />}
      {mode === "offline" && <OfflineRunner game={selectedGame} onExit={toMenu} />}
      {mode === "catalog" && (
        <Catalog
          onLaunch={(game, launch) => {
            setSelectedGame(game);
            setMode(launch === "online" ? "online-setup" : launch);
          }}
          onExit={toMenu}
        />
      )}
      {mode === "compose" && (
        <Composer
          onPlay={(game) => {
            setSelectedGame(game);
            setMode("play");
          }}
          onExit={toMenu}
        />
      )}
      {mode === "online" && (
        <OnlineRunner
          intent={intent}
          code={code}
          nickname={nickname}
          roster={intent === "host" && isPrivateHost ? roster : undefined}
          hostGame={selectedGame}
          onExit={toMenu}
        />
      )}
    </main>
  );
}
