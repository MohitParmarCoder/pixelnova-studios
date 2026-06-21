# Block Blast — Usability Report

## Controls

| Action | Input |
|---|---|
| Blast a block group | Tap any block in the grid |
| Navigate DEAD → MENU | Tap anywhere |

Single-tap interaction throughout. No drag, swipe, or hold mechanics.

## Learning Curve

**Very low barrier:** SameGame-style mechanics are widely understood — tap matching adjacent blocks to remove them. The color-coded 7×9 grid communicates the interaction model immediately on first view.

**Group size rule:** Players learn quickly (after a failed single-block tap) that groups of 1 do not blast (`group.length >= 2` required). The audio `tap` sound with no blast effect provides enough negative feedback to teach this.

**Rising rows:** The timer bar below the grid showing time until next row is an effective pressure indicator that teaches the urgency loop without text.

## Visual Feedback

- **Blast particles:** 8 particles per blasted cell provide satisfying pop feedback.
- **Screen shake:** `shakeTime`/`shakeAmt` adds physical impact to large blasts.
- **Timer bar:** Visual countdown bar directly below the grid shows time remaining until the next row rises — always visible and clearly linked to the threat.
- **Score top-center:** Large, prominent, updates immediately on blast.
- **Flash on death:** Death state overlay distinguishes game over from normal play.

## Accessibility

- 7 distinct COLORS needed simultaneously — players with color-blindness affecting multiple color channels may struggle to distinguish all 7. No shape or pattern differentiation exists.
- No text required during gameplay (score is numeral only).
- No time-gated input — players can think before tapping, but the rising-row timer creates time pressure that cannot be paused.
- Audio uses distinct sounds per event (`gem` for blast, `lose` for death, `tap` for invalid tap).

## Mobile UX

- `CELL = floor(VW/(COLS+1))` sizes cells relative to virtual width — on a 390 px canvas with COLS=7 this gives cells of approximately 43 px, which is near the minimum comfortable touch target size (44 px recommended).
- Portrait orientation matches phone use.
- Grid is centered via `GRID_X = floor((VW - COLS*CELL)/2)`, avoiding accidental edge taps.
- `GRID_Y = floor(VH*0.18)` leaves adequate space for the score HUD above.

## UX Issues / Improvement Opportunities

1. **Color-only differentiation:** With 7 colors and no secondary identifier (pattern, shape, icon), colorblind players cannot reliably distinguish all block types. Adding a subtle texture or number overlay per color would fix this inclusivity gap.
2. **No group highlight on hover/touch-start:** Players cannot preview which cells will blast before committing. Highlighting the connected group on touch-start (before touch-end fires the blast) would improve strategic planning on slow taps.
3. **Single-cell tap produces audio but no visual rejection feedback:** A brief shake or color pulse on the tapped cell would communicate "group too small" more clearly than audio alone.
4. **No pause mechanic:** The 5-second rising-row timer runs without any pause option, making the game hostile to interruptions (notifications, phone calls).
5. **No combo or chain scoring:** Blasting multiple groups in quick succession earns no bonus, missing an opportunity to reward skilled play.
6. **DEAD state goes directly to MENU on tap:** No score summary or best-score comparison is shown before returning — players never see their result in context.
7. **7 colors may be visually crowded on a 7×9 grid:** With maximum entropy, the grid can look chaotic. Reducing to 5 colors would create larger groups and more satisfying chain opportunities.
