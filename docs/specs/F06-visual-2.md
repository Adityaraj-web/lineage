# F06 Visual pass 2 — "Aurora glass"

Branch: `f06-dashboard` (continue) · Prefix `F06:` · New Claude Code session: read CLAUDE.md, F06.md, F06-visual.md and this file first. Plan at `/effort high`, build at `/effort high`. This is the last big visual pass: timebox about 2.5 hours, then only small fixes.

## What's wrong now (from Adityaraj's review of the real browser)

1. **The ledger field is noise.** Random threads move everywhere and cross text: the "Both vaults run one build" paragraph, the agent-key paragraph, headings. Moving lines that mean nothing confuse a first-time viewer. Ambient threads are removed.
2. **The surfaces are flat.** Near-black cards on a near-black ground. Glass only reads as glass when there is colour and depth behind it.
3. **The hero right side is weak.** It shows three lines and an empty grey box.
4. **Scene 3's labels collide** ("vault" and "vendor-payments" wrap and overlap at the top of the stage).
5. **Doorway "Review what needs you" is mostly empty space** above a lone "1".

What works and stays: the page structure; scene 2's diagram (clear); the story strip; the risk card; the payments table; the copy rules; the data layer; all tests; reduced motion; the contrast discipline.

## Direction: dark aurora glass

Stay dark. The provenance colours are light sources (emerald, sky, amber, rose). On a light ground they turn pastel and the "thread of light" idea dies. What's missing is depth, not lightness.

### 1. Background: a slow living gradient, no lines

- **Remove the `LedgerField` canvas from the layout.** Delete it, its engine and its tests if nothing else uses them. No ambient threads anywhere.
- **Replace it with a full-viewport animated mesh gradient** (WebGL fragment shader). Use a small, well-maintained shader package if one fits (check its React 19 / static-export compatibility). Otherwise write the shader by hand, about 150 lines, no three.js.
  - Colours: ink `#070A12`, deep indigo `#1A1F4D`, teal `#0E3B43`, a faint emerald, plus a touch of amber low on the page.
  - Very slow motion (a full cycle of about 40 s).
  - Large soft shapes with high contrast between light and dark regions, so the glass above it has something to refract.
- **Per-page hue, subtle:**

  | Page | Gradient |
  |---|---|
  | Overview | indigo/teal |
  | Lineage | teal/emerald |
  | LimitsOnly | indigo/rose |
  | Compare | teal left, rose right |

  Cross-fade between them in 800 ms on route change.
- Fine film grain over the gradient (static noise texture, ~4% opacity) to prevent banding, especially in the video recording.
- **Cursor light:** a soft radial glow (~400 px, 6–8% white) that follows the pointer on a spring, behind the glass. It lights up whatever glass panel it passes behind. Off on coarse pointers and under reduced motion.
- Performance: render at 0.5× resolution and upscale (it's soft anyway), 30 fps is enough, pause when hidden or off-screen. Reduced motion: a single static frame. If WebGL is unavailable: a CSS gradient with the same colours.

### 2. Real glass surfaces

One `Glass` component used for every panel. Three tiers: stage, card, chip.

- `backdrop-filter: blur(24px) saturate(160%)`; fill `rgba(255,255,255,0.05–0.08)`.
- A 1 px border with a gradient (bright at the top-left `rgba(255,255,255,0.22)`, fading to `0.04`), done with a mask or a pseudo-element, not a flat border.
- An inner top highlight (`inset 0 1px 0 rgba(255,255,255,0.10)`).
- A long, soft, slightly tinted shadow (`0 30px 80px -30px` in the page hue at ~40%).
- **Specular glare:** a radial highlight inside the panel that follows the pointer (CSS variables set on pointermove, only on hover-fine devices), max 10% white.
- Doorways and the hero vault get a subtle 3D tilt on hover (spring, ≤ 4°). Nothing else tilts.
- Budget: no more than 8 blurred panels on screen at once. Low-power devices drop the blur to 12 px.
- Text on glass keeps ≥ 4.5:1 (re-run the contrast check, which now samples the gradient under each panel).

### 3. Hero centrepiece: the glass vault

Replace the right-hand diagram:

- A tall **glass vault panel** with a gate slot on its left edge.
- Three threads enter from the left with labels: "Signed by you", "Your registry", "An email". These are the only moving lines on the page, and they belong to the story.
- The P1 and P2 threads pass into the vault, and each arrival makes the vault glow briefly in its colour.
- The P3 thread stops at the gate, which glows amber.
- Inside the vault, live text: **"2 paid"** in emerald, **"1 held for you"** in amber, and the balance below. The vault is never empty.
- The composition must look finished as a still frame (screenshot it at rest).

### 4. Threads only where they tell the story

Threads now appear only inside the hero, scene 2, scene 3, the Compare stage and the A-102 connector. They never pass under or over body text. Each one draws once per scene and then rests as a thin glowing line.

### 5. Fixes

- **Scene 3:** "vault" and "vendor-payments" labels are fully readable, don't wrap mid-word and don't overlap. Give the node labels fixed slots.
- **Doorways:**
  - "Review what needs you" shows a compact preview of the held payment (49 tUSDC → vendor-payments, a P3 badge and the High-risk pill), not a lone number.
  - All three doorways are glass with the glare and the tilt.
- **Proof section:** no lines crossing its text (resolved by removing the field).
- **The digit "1"** must not read as "l": enable a Plus Jakarta alternate if one exists. Otherwise set numerals in Plus Jakarta with `font-feature-settings` checked in the browser, and as a last resort use JetBrains Mono for the single-digit counts only.
- **Vault header meta line:** a clear gap between items, wrapping cleanly.

## Keep unchanged

- Pages, scenes, scroll lengths, Lenis, view transitions, the poll cache and the data layer.
- All copy rules (no eyebrows, no italic accents, no middle dots, sentence case).
- Tests:
  - every existing test passes, apart from field tests removed with the field;
  - add a render test that the Glass component renders children;
  - `verify:web` 8/8; static build with no `/api`.

## Stop report (short)

- test/verify/build lines;
- shader cost: average ms per frame at 1440, DPR 2, and fps on a real GPU (not headless) if you can run headed;
- contrast minimum over glass;
- screenshots at 1440: the hero at rest; scene 2 at 100%; scene 3 at 100%; the doorways; /vault/vault top; /compare stage at 100%; one at 390 of the hero;
- what you removed;
- what you'd still change.