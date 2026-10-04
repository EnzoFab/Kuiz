import { useEffect, useState } from "react";
import type { Game } from "@kuiz/core";
import { Button, Card } from "../ui";
import { SERVER_URL } from "../lib/socket";
import { TEMPLATES, loadGames } from "../compose/templates";

/**
 * Catalog UI (B17): browse templates and your saved games, then start a Session from one —
 * on this device, offline (host), or online (host). Templates come from the server catalog
 * (GET /catalog, B15) when reachable, plus the bundled owner-authored presets; saved games
 * come from localStorage (B16). See docs/spec/persistence-model.md, authoring-model.md.
 */

export type LaunchMode = "play" | "offline" | "online";

interface Entry {
  key: string;
  title: string;
  /** A fresh Game to launch (templates instantiate a new copy; saved games play as-is). */
  get: () => Game;
}

async function fetchServerTemplates(): Promise<Game[]> {
  try {
    const res = await fetch(`${SERVER_URL}/catalog`);
    if (!res.ok) {
      return [];
    }
    const body = (await res.json()) as { templates: { json: Game }[] };
    return body.templates.map((t) => t.json);
  } catch {
    return []; // server/catalog not running — fall back to the bundled templates
  }
}

export function Catalog({
  onLaunch,
  onExit,
}: {
  onLaunch: (game: Game, mode: LaunchMode) => void;
  onExit: () => void;
}) {
  const [serverTemplates, setServerTemplates] = useState<Game[]>([]);
  const saved = loadGames();

  useEffect(() => {
    fetchServerTemplates().then(setServerTemplates);
  }, []);

  const templates: Entry[] = [
    ...TEMPLATES.filter((t) => t.name !== "Blank").map((t) => ({
      key: `tpl:${t.name}`,
      title: t.name,
      get: t.instantiate,
    })),
    ...serverTemplates.map((g) => ({ key: `srv:${g.id}`, title: g.title, get: () => g })),
  ];

  return (
    <div className="mx-auto max-w-xl space-y-5 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight">Catalog</h1>
        <Button variant="outline" onClick={onExit}>
          Back
        </Button>
      </header>

      <Section title="Templates" entries={templates} onLaunch={onLaunch} empty="No templates." />
      {saved.length > 0 && (
        <Section
          title="Your games"
          entries={saved.map((g) => ({ key: `saved:${g.id}`, title: g.title, get: () => g }))}
          onLaunch={onLaunch}
          empty=""
        />
      )}
    </div>
  );
}

function Section({
  title,
  entries,
  onLaunch,
  empty,
}: {
  title: string;
  entries: Entry[];
  onLaunch: (game: Game, mode: LaunchMode) => void;
  empty: string;
}) {
  return (
    <Card className="space-y-3">
      <p className="text-muted-foreground">{title}</p>
      {entries.length === 0 && empty && <p className="text-muted-foreground text-sm">{empty}</p>}
      <ul className="space-y-3">
        {entries.map((e) => (
          <li key={e.key} className="space-y-2">
            <span className="font-semibold">{e.title}</span>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => onLaunch(e.get(), "online")}>Host online</Button>
              <Button variant="outline" onClick={() => onLaunch(e.get(), "offline")}>
                Offline
              </Button>
              <Button variant="outline" onClick={() => onLaunch(e.get(), "play")}>
                This device
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
