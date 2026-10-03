# Authoring model (v1)

Status: **decided** (wayfinder ticket #6). How a Game Master composes a Game from Bricks and
fills in content, without a visual builder. Feeds #10 (Simple Quiz reference), #11 (build plan).

See [`CONTEXT.md`](../../CONTEXT.md) and `docs/spec/game-definition-schema.md`,
`docs/spec/brick-contract.md`.

## v1 surface: template-first + a minimal form-based composer

- **No visual drag-and-drop canvas** in v1 (deferred); the **MCP authoring server** is the
  richer path, later.
- Authoring is a **thin editor over the Game JSON** (#12): a simple **tree/list** of Segments
  and Bricks plus per-Brick **forms**. A GM can compose from scratch *or* customize a template.

## Entry points (Q4)

- **New from Template** — a preset whole Game (e.g. "Friday Night Quiz").
- **New from Segment Type** — drop in a preset sub-game (e.g. "Blind Test") and customize.
- **New blank** — build up from the Catalog.

Templates and Segment Types are **owner-authored in v1** (player-published later). Most GMs
start from one and swap content ("Blind Test template → my playlist").

## Composition operations (map 1:1 to the schema)

Each operation edits the Game document (#12) and nothing else:

- add / remove / reorder a **group** (Segment) or a **Brick** (leaf)
- **nest** groups
- edit a **Brick's config** (its content)
- set a group's **scoring `aggregation`**

Output is always a valid Game document — the exact JSON the engine runs.

## Brick authoring forms (Q2)

- **Default: schema-driven.** A generic form renderer builds the form from the Brick's
  machine-readable `configSchema` (#13) — so **a new Brick gets an authoring form for free**.
- **Optional override:** a Brick may supply a custom `Authoring` view (the one in the #13
  contract) when the generic form isn't enough (e.g. a Spotify playlist picker, a
  drag-to-order answer editor).

> Refinement to #13: `BrickView.Authoring` is **optional** — absent → the generic
> schema-driven form is used; present → it overrides.

## Validation

Live, during authoring: the Game document is validated against the game-definition schema and
each Brick's `configSchema`. Mode compatibility is surfaced here too — a Game containing a
Brick with `capabilities.modes: ["online"]` can't be played offline (warn at authoring,
enforce at session start, per #8).

## Saving

Authoring only **produces/edits the Game document**. Where it is stored — localStorage for
anonymous, DB catalog for logged-in / MCP — is ticket #9.

## Later (design-for)

The **MCP authoring server** exposes these same operations as tools over the same JSON
(`add_brick`, `set_config`, `validate_game`, …); a visual builder is a separate later effort.
Both reuse the Brick `configSchema` and the composition operations defined here.
