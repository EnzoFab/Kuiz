import { useState } from "react";
import { safeParseGame, type Game, type Segment } from "@kuiz/core";
import { brickRegistry } from "@kuiz/bricks";
import { Button, Card, Input, Select } from "../ui";
import { brickViews } from "../bricks/views";
import { SchemaForm } from "./SchemaForm";
import { TEMPLATES, loadGames, saveGame, deleteGame } from "./templates";

/**
 * The authoring composer (B16): a thin, template-first editor over the Game JSON — pick a
 * template, add/remove/reorder leaf Bricks, edit each Brick's config (custom or generic
 * schema-driven form), set the root group's scoring. Drafts autosave to localStorage; "Play"
 * hands the composed Game to the device runner. See docs/spec/authoring-model.md.
 *
 * v1 edits a flat list of leaf Bricks under the root group; nested sub-groups are shown
 * read-only (composing them is a later step).
 */

type LeafChild = Extract<Segment, { kind: "brick" }>;

const AGGREGATIONS = ["sum_points", "count_wins"];

export function Composer({ onPlay, onExit }: { onPlay: (game: Game) => void; onExit: () => void }) {
  const [games, setGames] = useState<Game[]>(() => loadGames());
  const [editing, setEditing] = useState<Game | null>(null);

  const open = (game: Game) => {
    saveGame(game);
    setGames(loadGames());
    setEditing(game);
  };

  if (editing) {
    return (
      <GameEditor
        game={editing}
        onChange={(next) => {
          saveGame(next);
          setEditing(next);
        }}
        onPlay={() => onPlay(editing)}
        onBack={() => {
          setGames(loadGames());
          setEditing(null);
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-5 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight">Your games</h1>
        <Button variant="outline" onClick={onExit}>
          Back
        </Button>
      </header>

      <Card className="space-y-3">
        <p className="text-muted-foreground">Start a new game</p>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map((t) => (
            <Button key={t.name} variant="outline" onClick={() => open(t.instantiate())}>
              {t.name}
            </Button>
          ))}
        </div>
      </Card>

      {games.length > 0 && (
        <Card className="space-y-2">
          <p className="text-muted-foreground">Saved games</p>
          <ul className="space-y-2">
            {games.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-2">
                <span className="truncate font-semibold">{g.title}</span>
                <span className="flex shrink-0 gap-2">
                  <Button variant="outline" onClick={() => setEditing(g)}>
                    Edit
                  </Button>
                  <Button onClick={() => onPlay(g)}>Play</Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      deleteGame(g.id);
                      setGames(loadGames());
                    }}
                  >
                    ✕
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function GameEditor({
  game,
  onChange,
  onPlay,
  onBack,
}: {
  game: Game;
  onChange: (game: Game) => void;
  onPlay: () => void;
  onBack: () => void;
}) {
  const root = game.root;
  if (root.kind !== "group") {
    return <Card className="m-4">This game's root isn't a group — not editable in v1.</Card>;
  }
  const children = root.children;
  const setChildren = (next: Segment[]) => onChange({ ...game, root: { ...root, children: next } });

  const updateChild = (i: number, child: Segment) => {
    setChildren(children.map((c, idx) => (idx === i ? child : c)));
  };
  const move = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= children.length) {
      return;
    }
    const next = [...children];
    [next[i], next[j]] = [next[j], next[i]];
    setChildren(next);
  };
  const addBrick = (type: string) => {
    const leaf: LeafChild = {
      id: crypto.randomUUID(),
      kind: "brick",
      scoring: { basePoints: 10, grading: "binary" },
      brick: { type, config: structuredClone(brickViews[type]?.defaultConfig ?? {}) },
    };
    setChildren([...children, leaf]);
  };

  const parsed = safeParseGame(game);
  const isValid = parsed.success;

  return (
    <div className="mx-auto max-w-xl space-y-5 p-4">
      <header className="flex items-center justify-between gap-2">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button disabled={!isValid} onClick={onPlay}>
          Play
        </Button>
      </header>

      <Card className="space-y-3">
        <label className="text-muted-foreground block text-sm">Title</label>
        <Input value={game.title} onChange={(e) => onChange({ ...game, title: e.target.value })} />
        <label className="text-muted-foreground block text-sm">Scoring</label>
        <Select
          value={root.scoring?.aggregation ?? "sum_points"}
          onChange={(e) => onChange({ ...game, root: { ...root, scoring: { aggregation: e.target.value } } })}
        >
          {AGGREGATIONS.map((a) => (
            <option key={a} value={a}>
              {a.replace("_", " ")}
            </option>
          ))}
        </Select>
      </Card>

      {children.map((child, i) =>
        child.kind === "brick" ? (
          <BrickEditor
            key={child.id}
            leaf={child}
            index={i}
            total={children.length}
            onChange={(next) => updateChild(i, next)}
            onMove={(delta) => move(i, delta)}
            onRemove={() => setChildren(children.filter((_, idx) => idx !== i))}
          />
        ) : (
          <Card key={child.id} className="text-muted-foreground text-sm">
            Nested group “{child.id}” — editing nested groups isn’t supported in v1.
          </Card>
        ),
      )}

      <Card className="space-y-2">
        <label className="text-muted-foreground block text-sm">Add a brick</label>
        <div className="flex flex-wrap gap-2">
          {brickRegistry.types().map((type) => (
            <Button key={type} variant="outline" onClick={() => addBrick(type)}>
              + {brickViews[type]?.label ?? type}
            </Button>
          ))}
        </div>
      </Card>

      {!isValid && (
        <p className="text-sm text-[color:var(--color-bad,#dc2626)]">
          {parsed.error.issues[0]?.message ?? "Game is incomplete."} — fix before playing.
        </p>
      )}
    </div>
  );
}

function BrickEditor({
  leaf,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}: {
  leaf: LeafChild;
  index: number;
  total: number;
  onChange: (leaf: LeafChild) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  const view = brickViews[leaf.brick.type];
  const Authoring = view?.Authoring;
  const def = brickRegistry.has(leaf.brick.type) ? brickRegistry.get(leaf.brick.type) : undefined;
  const setConfig = (config: Record<string, unknown>) =>
    onChange({ ...leaf, brick: { ...leaf.brick, config } });

  const isConfigValid = def?.configSchema ? def.configSchema.safeParse(leaf.brick.config).success : true;

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-semibold">
          {index + 1}. {view?.label ?? leaf.brick.type}
          {!isConfigValid && <span className="text-muted-foreground ml-2 text-sm">⚠ incomplete</span>}
        </span>
        <span className="flex gap-1">
          <Button variant="outline" disabled={index === 0} onClick={() => onMove(-1)}>
            ↑
          </Button>
          <Button variant="outline" disabled={index === total - 1} onClick={() => onMove(1)}>
            ↓
          </Button>
          <Button variant="outline" onClick={onRemove}>
            ✕
          </Button>
        </span>
      </div>

      {Authoring ? (
        <Authoring config={leaf.brick.config} onChange={setConfig} />
      ) : (
        <SchemaForm schema={def?.configSchema} config={leaf.brick.config} onChange={setConfig} />
      )}

      <div>
        <label className="text-muted-foreground block text-sm">Points</label>
        <Input
          type="number"
          min="0"
          value={leaf.scoring?.basePoints ?? 0}
          onChange={(e) =>
            onChange({
              ...leaf,
              scoring: { basePoints: Number(e.target.value), grading: leaf.scoring?.grading ?? "binary" },
            })
          }
        />
      </div>
    </Card>
  );
}
