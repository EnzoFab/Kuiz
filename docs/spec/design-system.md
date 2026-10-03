# Design system & visual identity (v1 foundation)

Status: **decided** (wayfinder ticket #15). The rendering foundation for the web app and Brick
views. Blocks build step B8. The **detailed brand design system** (palette, typography, logo,
component polish, motion) is a deliberate **follow-up the project owner will draft later** to
enhance visuals/UX — this ticket sets a foundation that makes that a token-level change, not a
rebuild.

## Decisions

- **Styling: Tailwind CSS.** Utility-first; tokens expressed as CSS variables; trivial theming.
  Fits Vite + React.
- **Components: shadcn/ui** (Radix primitives + Tailwind, components copied into the repo and
  owned) for the **app shell** — forms, dialogs, lobby, catalog, authoring UI. No heavy
  prebuilt library (MUI/Chakra) whose built-in look would fight a custom party-game aesthetic.
  **Hand-rolled** Tailwind components for the **gameplay surface** (question cards, answer
  inputs, buzzers, Scorecard) where bespoke flair matters.
- **Tokens & theming:** colors, spacing, typography, radii defined as **CSS-variable tokens**
  on `:root`, redefined for **dark mode**; **light + dark from day one**. Components and Brick
  views consume **only tokens** — never hard-coded colors — so rebranding is a token swap and
  every Brick matches by construction.
- **Shared web UI kit:** a small `ui/` layer in `apps/web` holds the tokens + base primitives;
  each Brick's **web view** imports from it, so bricks are visually consistent. (A future
  `apps/mobile` provides its own native kit against the same token names.)

## Visual direction (principles — north star)

Phone-first party game:
- **Bold, high-contrast, playful**; large **touch targets**; big, legible question text.
- **Lively feedback**: answer lock-in, reveal, and score changes animate; a punchy Scorecard.
- Distinct **host/presentation** styling (big-screen legibility, for offline + the deferred
  online TV view) vs **player** styling (thumb-friendly, one-handed).

## Follow-up (owner-led, deferred)

A fuller brand design system — exact palette, typography scale, logo, component polish, motion
language — comes later. Because everything above is tokenized and components are owned (shadcn),
that work lands as token/value changes and component refinement, not a re-architecture.
Nothing in v1 hard-codes a look that would block it.
