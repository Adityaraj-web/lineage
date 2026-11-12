# F06 Phase 3 — Visual pass: from dashboard to a site that sells the idea

Branch: `f06-dashboard` (continue) · Commit prefix: `F06:` · Plan first, then build at `/effort high`. Stop once, at the end, with screenshots.

## Why the current UI reads as generated

It hits the common defaults one after another:
- a tracked ALL-CAPS eyebrow above every heading;
- one italic accent word in every headline;
- monospace meta strings joined with middle dots;
- `→` on every link;
- near-black with flat panels;
- every section chopped into identical rounded cards;
- explanatory sub-lines under every badge.

The content is right; the presentation is a template. This pass keeps the data layer and the tests and changes how the story is told.

Before planning, load any design skills installed in this environment (for example `frontend-design`, `emil-design-eng`, `design-taste-frontend`) and follow them where they don't conflict with this brief. The brief wins.

## Concept: "lineage" as a thread of light

Every payment is a thread that leads back to where its payee came from. Threads that lead back to you (P1) or to a registry you trust (P2) reach the vault. A thread with no origin (P3) stops at a gate. The thread is the one visual idea: it runs through the background, the hero, the scroll scenes and the risk card. Spend the boldness there and keep everything else quiet.

## Tokens

- **Colour.** Base ink `#0A0D14` (deep blue-black, not neutral grey), raised surface `#111622`, hairline `rgba(255,255,255,0.07)`, text `#ECEEF3`, muted `#9AA3B5`. Threads: P1 `#34D399`, P2 `#38BDF8`, P3 `#FBBF24`, attacker `#FB7185`. Accents appear as light (threads, glows, aurora), almost never as filled blocks.
- **Type.**
  - Display: Instrument Serif, headings only, ≥ 36 px, tracking +0.01 to +0.02em, line-height 1.05–1.1. No italic accent words. Fallback: if it still looks cramped in the screenshots, render the hero in Fraunces as well and show both.
  - UI and body: Plus Jakarta Sans (400/500/600). All numbers use it with tabular figures. This includes the big stats; the serif is never used for numbers.
  - Data: JetBrains Mono, only for account ids and hashes.
  - Labels are sentence case. No all-caps eyebrows. Bundle every font locally with next/font/local and its OFL licence file.
- **Shape.** Large radius only on the two stages (hero, compare); 12 px on small surfaces. Not every group is a card: use spacing and hairlines for most structure.

## Background: the ledger field (every page)

Plain Canvas 2D, no library, one rAF loop:
- a faint dot grid;
- threads of light travel along it in P1/P2/P3 colours;
- P1/P2 threads finish; every few seconds a P3 thread hits a small gate and flickers out;
- a cursor spotlight brightens the grid within ~180 px, following the cursor on a spring;
- an aurora behind the content, clearly visible but never behind body text at more than ~15% luminance.

Per-page mood:

| Page | Field |
|---|---|
| Overview | full field, multi-colour aurora |
| Lineage vault | emerald aurora, amber threads stop at gates |
| LimitsOnly vault | rose aurora, amber threads pass through and turn rose |
| Compare | split field: emerald left, rose right |

Performance:
- pause when the tab is hidden;
- ~30 fps cap on low-power devices;
- device-pixel-ratio capped at 2;
- no layout reads inside the loop.

Reduced motion: a static grid with threads drawn in place, and no spotlight.

## Overview becomes the hub, told by scroll

Each scene reveals differently, and the reveal is the content, not a generic fade-up. Scenes 2 and 3 use sticky pinning, with progress from `useScroll` + `useTransform` (transform/opacity only).

1. **Hero (100vh).** Headline "Prepared statements for money." One line under it: "Your AI agent can ask to pay anyone. The vault pays only payees whose origin it can trace." Live chip: "1 payment needs you" → inbox. A small scroll cue.
2. **Three emails (pinned, about 250vh of scroll).** The three real emails come in from the left, one at a time, as scroll advances:
   - each one draws its thread: to your signature (P1), to the registry then back (P2);
   - each reaches the vault: "Paid";
   - the third thread has no origin and stops at the gate, which closes with an amber glow: "Held for you".
   - The badges appear only when their thread lands.
3. **Same request, two vaults (pinned).** The poisoned invoice splits into two threads. As scroll continues, the left vault's gate closes and the right one opens, and the counters run to 0 and 49 tUSDC. It ends with one button: "Watch it side by side" → /compare.
4. **Proof.** Two short facts, set large, revealed with a clip-path wipe:
   - "Same code": both vaults share one code hash, shown as the seal;
   - "The agent can only ask": one function-call key, `request_payment` only.
5. **Doorways.** Three large panels: "Review what needs you", "See the attack side by side", "Inspect the vaults". On hover (gated by `hover: hover`) the panel's thread draws across it and the background tint shifts. The whole panel is the link.

Remove from the Overview:
- the boxed flow diagram (scene 2 replaces it);
- the legend paragraph;
- the separate vault, key and registry cards (their facts move into scenes 4 and 5 and the vault pages).

## Vault pages: crisp app, quiet motion

These are working screens, so motion is fast and functional (under 250 ms, custom ease-out).

- **Story strip at the top.**
  - Lineage: "Read 3 emails · asked for 3 payments · paid 2 · held 1 for you", where each step is the coloured badge.
  - LimitsOnly: "… paid all 3, including the attacker."
- **Header:** balance and state as two large numbers; owner, token and code hash collapse into one quiet line (short hash, full hash on hover).
- **Lineage inbox.** The held payment is the hero of the page.
  - Lead with the A-102 thread: this memo's "A-102" connects by a drawn thread to Alice's paid A-102 payment. This is the first thing you see in the card.
  - Then the summary sentence, then the findings, compact (icon + one line each).
  - Drop "Why the vault held it" (the summary covers it) and the "requested … by" footer.
- **LimitsOnly.** Replace the empty inbox with a rose stat: "Paid to the attacker: 98 tUSDC across 2 runs", with the two payments listed under it.
- **Tasks:** show only the latest demo-run task; earlier ones sit under "Earlier tasks (2)", collapsed.
- **Payments table:**
  - remove the sub-lines under badges (move them to a tooltip);
  - drop the per-row timestamp line from the memo cell (show it on hover);
  - give "paid without asking" rows a faint rose wash;
  - new or changed rows still animate as in Phase 2.

## Compare: scroll-driven, then interactive

- The title stays: "One poisoned invoice".
- The intro becomes one sentence.
- **The stage is pinned.** Scroll steps through the three emails:
  - rows 01 and 02 land identically on both sides (threads to the same badges);
  - at row 03 the field splits: Lineage's gate closes (amber), LimitsOnly's thread reaches the attacker (rose flash);
  - the counters run to 0 and 49;
  - the seal stamps in between them last.
- After the scene, the full table is shown statically for reading, with tx links as small icons only.
- Keep Replay. Remove "agent called pay_…" lines (tooltip instead).
- Under reduced motion, show the final state, not pinned.

## Navigation and transitions

- **Nav:** never scrolls on desktop (fix the visible scrollbar). Links: Overview, Lineage vault, LimitsOnly vault, Compare. The active underline slides between them. On phones, collapse into a menu.
- **Page transitions:** use the installed Next.js / React View Transitions support (check the bundled docs) for a cross-fade with a slight rise. Shared elements where they exist:
  - the "49 tUSDC" stat into Compare's counter;
  - "1 payment needs you" into the inbox heading.
  - If View Transitions isn't supported in the installed version, use a client-side fade with `motion`.

## Copy rules

Plain words, sentence case. Each element does one job. Remove anything that repeats what a badge or number already says. No `→` on text links (buttons may have an icon). No middle-dot meta strings.

## Quality floor

- Buttons scale to 0.97 on press.
- Hover effects only behind `@media (hover: hover) and (pointer: fine)`.
- Animate only transform and opacity (plus clip-path for wipes); for Motion under load use full `transform` strings.
- No `transition: all`.
- Visible focus rings; keyboard navigation through doorways and tables.
- Responsive down to 390 px:
  - pinned scenes become stacked steps on narrow screens;
  - the hero has no sideways scroll.
- Reduced motion: every scene has a readable static version.
- Text contrast ≥ 4.5:1 over the aurora.

## Must stay true

- **Phase 1 code:** `web/src/lib` is untouched except for additions.
- **Tests:**
  - all existing unit tests pass;
  - update render tests whose text changed, but keep the XSS test, the "no approve/reject/freeze buttons" test and the provenance badge tests;
  - add render tests for the story strip and the LimitsOnly attacker stat.
- **Live checks and build:** `npm run verify:web` still 8/8; `npm run web:build` static export with no `/api`.
- **Data:** all story numbers come from live data (demo-run plus the chain), not hard-coded, except the conceptual labels in the scroll scenes.

## Plan contents

- the revised token plan, with any changes from this brief and why;
- an ASCII wireframe per page;
- for each scroll scene: scroll range, pinned or not, what each 10% of progress does, the reduced-motion and mobile versions;
- the canvas field design and its performance budget;
- the commit sequence.

## Stop report

- full-page screenshots at 1440 px and 390 px for all four pages;
- for each pinned scene, frames at 0 / 33 / 66 / 100% scroll progress;
- reduced-motion screenshots of Overview and Compare;
- test, verify and build output;
- a "removed" list (what text and chrome was cut);
- what you would still change.