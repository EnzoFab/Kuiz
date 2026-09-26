# Kuiz

Kuiz is a platform for composing and playing quiz-style party games. A Game Master builds a
Game from reusable pieces (like an n8n flow) and runs it as a Session players join — online
on their phones, or offline on a shared display the Game Master drives. Domain glossary:
[CONTEXT.md](CONTEXT.md).

## Start here: this project is being planned with `/wayfinder`

The v1 spec is not written yet. It is being charted as a **wayfinder map** — a set of
decision tickets worked one per session until a full build plan exists. **Do not start
building app code yet.** First resolve the map.

The **issue tracker is GitHub** (see [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md)).
The living map is issue **[#1](https://github.com/EnzoFab/Kuiz/issues/1)**; its tickets are
that issue's sub-issues.

When you begin a working session on Kuiz, run:

```bash
/wayfinder https://github.com/EnzoFab/Kuiz/issues/1
```

Wayfinder reads the map, finds the next unblocked ticket, and works it with the user (or
solo for research tickets). To work a specific ticket, pass its issue URL/number instead.

The planning phase is done when the **v1 build plan** ticket
([#11](https://github.com/EnzoFab/Kuiz/issues/11)) is resolved. Only then does normal build
work (with skills like `tdd`, `code-review`) begin.

## Tracking what's done

- **Board (kanban)**: [Kuiz v1 Spec project](https://github.com/users/EnzoFab/projects/1) —
  Todo / In Progress / Done. Cards do **not** move automatically; when working a ticket,
  move its card yourself (see Rules below).
- **Frontier (what's workable now)** — open tickets with no open blocker and no assignee:

  ```bash
  gh issue list --repo EnzoFab/Kuiz --state open --label "wayfinder:research,wayfinder:grilling,wayfinder:prototype,wayfinder:task" \
    --json number,title,assignees,labels --jq '.[] | select(.assignees|length==0) | "#\(.number) \(.title)"'
  ```

  (A ticket is truly ready only if its `issue_dependencies_summary.blocked_by` is 0 — the
  GitHub UI shows this; `gh issue view <n>` confirms.)

## Rules of the map

- **One ticket per working session** (research tickets are the only exception).
- **Claim before working**: `gh issue edit <n> --repo EnzoFab/Kuiz --add-assignee @me`, and
  move its board card to **In Progress**.
- **On resolve**: `gh issue comment <n>` with the answer, `gh issue close <n>`, move its
  board card to **Done**, and add a one-line gist + link to the map's **Decisions so far**
  ([#1](https://github.com/EnzoFab/Kuiz/issues/1)).
- Resolving a ticket may unblock others or graduate fog into new tickets — expected. Add new
  tickets as sub-issues of #1 and to the board.

Board plumbing (for moving a card): project `PVT_kwHOAbYXFc4BkyZj`, Status field
`PVTSSF_lAHOAbYXFc4BkyZjzhjhtY0` (options: Todo `f75ad846`, In Progress `47fc9ee4`,
Done `98236657`). Find an item id with
`gh project item-list 1 --owner EnzoFab --format json`, then
`gh project item-edit --id <itemId> --project-id <projId> --field-id <fieldId> --single-select-option-id <optId>`.

A human-readable snapshot of the map lives at
[.scratch/kuiz-v1-spec/map.md](.scratch/kuiz-v1-spec/map.md) (does not auto-update; GitHub
is canonical).
