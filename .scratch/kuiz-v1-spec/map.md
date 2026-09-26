<!-- wayfinder:map (snapshot) -->

# Kuiz v1 Spec — map (snapshot)

> **The living map is GitHub issue [#1](https://github.com/EnzoFab/Kuiz/issues/1).**
> Tickets are its sub-issues; status, blocking, and the Decisions-so-far index live there.
> This file is a human-readable snapshot committed with the code — it does not auto-update.

## Destination

A locked v1 spec for Kuiz: a domain model + architecture for the **piece/flow
game-building engine** and the **session/play runtime** (online realtime + offline
TV-walkthrough), designed so the full platform vision integrates without rework — plus a
**phased, session-by-session build plan** of actionable items. The extensibility model —
adding new Segment Types without touching the core engine — is the decision everything
else defers to. This effort **plans**; it does not build.

## Settled constraints

- **Stack**: React web + Node/TypeScript backend; responsive web is the mobile surface for
  v1 (native later). Realtime (WebSockets) for online sessions.
- **v1 slice**: online mode for real play; offline = render-and-advance walkthrough with
  **no scoring**. Segment Types: Simple Quiz, Blind Test, Themed A-Z. Default aggregation =
  sum of points.
- **Authoring**: no visual builder in v1 (templates + minimal config; MCP server later).
- **Players**: no login — nickname per session; session data ephemeral.
- **Each Segment Type owns its own authoring, display, and play logic** — the seam.
- **Design-for, build later**: native app; player accounts; player-authored templates; MCP
  authoring; conditional flows; manual offline scoring; extra aggregation types.
- **Out of scope**: visual flow-builder UI; template marketplace.

Domain glossary: [CONTEXT.md](../../CONTEXT.md).

## Tickets

| # | Ticket | Issue | Type | Needs grilling? | Blocked by |
|---|--------|-------|------|-----------------|------------|
| 01 | Flow/pipeline engine patterns | [#2](https://github.com/EnzoFab/Kuiz/issues/2) | research | **No — AFK** | — |
| 02 | Realtime stack for Node | [#3](https://github.com/EnzoFab/Kuiz/issues/3) | research | **No — AFK** | — |
| 03 | Repository & stack architecture | [#4](https://github.com/EnzoFab/Kuiz/issues/4) | grilling | Yes | #3 |
| 04 | Game-definition schema | [#12](https://github.com/EnzoFab/Kuiz/issues/12) | grilling+dm | Yes | #2 |
| 05 | Segment Type contract | [#13](https://github.com/EnzoFab/Kuiz/issues/13) | grilling+dm | Yes | #12 |
| 06 | Flow execution model | [#5](https://github.com/EnzoFab/Kuiz/issues/5) | grilling | Yes | #12 |
| 07 | Scoring & aggregation model | [#14](https://github.com/EnzoFab/Kuiz/issues/14) | grilling+dm | Yes | #13 |
| 08 | Segment authoring model | [#6](https://github.com/EnzoFab/Kuiz/issues/6) | grilling | Yes | #13 |
| 09 | Online session lifecycle & realtime | [#7](https://github.com/EnzoFab/Kuiz/issues/7) | grilling | Yes | #5, #3 |
| 10 | Offline walkthrough runtime | [#8](https://github.com/EnzoFab/Kuiz/issues/8) | grilling | Yes | #5 |
| 11 | Persistence model | [#9](https://github.com/EnzoFab/Kuiz/issues/9) | grilling | Yes | #12 |
| 12 | Simple Quiz reference (prototype) | [#10](https://github.com/EnzoFab/Kuiz/issues/10) | prototype | Yes (react to prototype) | #13, #6 |
| 13 | v1 build plan | [#11](https://github.com/EnzoFab/Kuiz/issues/11) | grilling | Yes | all above |

**Frontier at charting**: [#2](https://github.com/EnzoFab/Kuiz/issues/2) and
[#3](https://github.com/EnzoFab/Kuiz/issues/3) (both AFK research, no blockers).
