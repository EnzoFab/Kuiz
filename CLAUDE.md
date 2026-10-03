# Kuiz

Kuiz is a platform for composing and playing quiz-style party games. A Game Master builds a
Game from reusable pieces (like an n8n flow) and runs it as a Session players join — online
on their phones, or offline on a shared display the Game Master drives. Domain glossary:
[CONTEXT.md](CONTEXT.md).

## Status: planning complete — now implementing

The wayfinder planning map ([#1](https://github.com/EnzoFab/Kuiz/issues/1)) is fully
resolved. The v1 design is locked in **`docs/spec/`** (schema, brick contract, flow engine,
online/offline, authoring, persistence, scoring, stack, design system), the glossary is
[CONTEXT.md](CONTEXT.md), and the build plan is [docs/build-plan.md](docs/build-plan.md).

**This project is now in implementation.** Work proceeds through **`build`-labelled issues**
(the 20 steps B1–B20, issues #16+) on the board, one per session, using skills like `tdd`
and `code-review`.

The **issue tracker is GitHub** (see [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md)).

When you begin a build session, pick the next ready build issue (unblocked, unassigned):

```bash
gh issue list --repo EnzoFab/Kuiz --state open --label build \
  --json number,title,assignees --jq '.[] | select(.assignees|length==0) | "#\(.number) \(.title)"'
```

(A step is truly ready only if its `issue_dependencies_summary.blocked_by` is 0 —
`gh issue view <n>` confirms. Each step's spec refs + done-check are in its issue body and
`docs/build-plan.md`.)

## Tracking what's done

- **Board (kanban)**: [Kuiz v1 Spec project](https://github.com/users/EnzoFab/projects/1) —
  Todo / In Progress / Done. Cards do **not** move automatically; when working a ticket,
  move its card yourself (see Rules below).
- **Done/resolved history**: the closed `wayfinder:*` issues (planning) and `build` issues
  (implementation) are the record; the planning map's decisions index is [#1](https://github.com/EnzoFab/Kuiz/issues/1).

## Working rules (implementation)

- **One build step per session.** Build steps depend on each other — work only a ready one
  (`blocked_by: 0`).
- **Branch per step**, named e.g. `build/b1-monorepo-scaffold`.
- **Claim before working**: `gh issue edit <n> --repo EnzoFab/Kuiz --add-assignee @me`, and
  move its board card to **In Progress**.
- **Open a PR** referencing the issue (`Closes #<n>`); on merge, the issue closes — move its
  board card to **Done**.
- Meet the issue's **done-check** before calling it done; follow the matching `docs/spec/*`.
- **`pnpm lint` (ESLint: curly + boolean naming) and `pnpm test` must pass** before a PR merges.
  `pnpm lint:fix` auto-fixes most style issues.
- **Run `ponytail-review` on each build PR before merge** — an over-engineering check (reinvented
  stdlib, needless deps, speculative abstractions, dead flexibility). Apply the findings worth
  applying; note any deliberately skipped.
- New out-of-plan work → a new `build` issue on the board, don't scope-creep a step.

## Code style (write for a human reader)

- **Boolean names read as a question**: a verb (or auxiliary) + what is checked —
  `isVisible`, `canPlay`, `hasAnswered`, `shouldReveal`, `isComplete`. Never a bare
  adjective or noun (`visible`, `answered`, `done`, `connected`).
- **Always use braces; no single-line `if`/`else`.** Even a one-statement branch gets a block
  on its own lines:

  ```ts
  if (done) {
    return;
  }
  ```

  not `if (done) return;`. Same for `else`.

## UI components: keep them swappable for a design system

A richer brand design system lands later (see `docs/spec/design-system.md`). Build every UI
component so that swap is a localized change, never a rewrite:

- **One swap seam.** All shared UI primitives live in `apps/web/src/ui/` and are imported from
  the `./ui` barrel — never deep-imported. Replacing the design system = replacing that folder;
  call sites don't change.
- **Tokens only.** Components use design tokens (CSS variables / token classes like
  `bg-primary`, `text-muted-foreground`, `border-border`). Never hardcode colors, radii, fonts,
  or bespoke spacing scales. A rebrand is a token change in `apps/web/src/index.css`.
- **Route everything through primitives.** Feature components and Brick views use `ui`
  primitives (`Button`, `Card`, `Input`, `Checkbox`, …), not raw styled `<button>`/`<input>`.
  New recurring element → add a primitive to `ui/`, don't inline it.
- **Minimal, generic APIs.** Primitive props stay generic (`variant`, `size`, standard HTML
  attrs) so a shadcn/other kit can back them without touching callers.
- **Presentational only.** No engine/business logic in components — logic stays in
  `@kuiz/core` / `@kuiz/bricks`; components receive data + callbacks.

Board plumbing (for moving a card): project `PVT_kwHOAbYXFc4BkyZj`, Status field
`PVTSSF_lAHOAbYXFc4BkyZjzhjhtY0` (options: Todo `f75ad846`, In Progress `47fc9ee4`,
Done `98236657`). Find an item id with
`gh project item-list 1 --owner EnzoFab --format json`, then
`gh project item-edit --id <itemId> --project-id <projId> --field-id <fieldId> --single-select-option-id <optId>`.

A human-readable snapshot of the map lives at
[.scratch/kuiz-v1-spec/map.md](.scratch/kuiz-v1-spec/map.md) (does not auto-update; GitHub
is canonical).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
