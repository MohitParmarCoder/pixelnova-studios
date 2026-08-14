# Paint Fill — Usability Report

## Controls
- **Primary mechanic:** Tap one of 4 color buttons at the bottom of the screen to flood-fill the grid from the top-left corner
- **No drag or swipe required** — all interaction is single discrete taps on the button row
- **Keyboard support:** None — the game has no `keydown` listener; it is tap/click only
- **Same-color tap:** Tapping the color that already occupies cell (0,0) is a no-op and does **not** cost a move (guarded in `floodFill`)

## Learning Curve
The game is immediately legible to players familiar with mobile flood-fill games (e.g., "Fill" genre). The mechanics are visible on first glance: the top-left corner is highlighted with a white border stroke, the color buttons at the bottom are labeled with glow when active, and the "CHOOSE COLOR" label appears above them. The move counter bar color-shifts green→orange→red as moves deplete, providing intuitive urgency. New players may need one run to understand that the fill always originates from the top-left.

## Visual Design
- **Score display:** Bold white 32px text centered at top, y=24
- **Best score:** Dimmed white 16px text at top-right (y=30)
- **Moves remaining:** Text counter at top-left (y=75), color-coded: green > 40%, orange 20–40%, red < 20%
- **Moves progress bar:** 120×10 px rounded bar below "MOVES" label (x=18, y=62), same color-coding as counter
- **Active color indicator:** The currently-selected color button shows a glow, thick white border ring, and a checkmark drawn in canvas paths
- **Board clear feedback:** `snd('gem')` plays; next board loads immediately (no delay animation)
- **Game over overlay:** Semi-transparent `rgba(26,26,46,0.78)` panel, "OUT OF MOVES!" in red with shadow, score in white, pulsing "TAP TO RETRY"
- **Death flash:** No screen flash on game over; a semi-transparent overlay is rendered instead
- **Particle effects:** None — the game uses no particle system

## Accessibility Notes
- **Color contrast:** 4 game colors (`#E74C3C` red, `#3498DB` blue, `#2ECC71` green, `#F39C12` orange) are distinct, but red/green combination is problematic for red-green color blindness (~8% of male players). No shape or pattern differentiation on color buttons to compensate.
- **One-handed playability:** Fully one-handed — all buttons are in the bottom third, reachable with a thumb
- **Session length:** Quick-play; each board takes 30 seconds to 2 minutes. Score resets on game over, encouraging repeated short sessions.
- **Text size:** HUD labels use 14–32px; readable but not large-print

## Mobile Optimization
- Fits 390×844 virtual canvas (letterboxed by harness)
- Color buttons are 64×64 px with 16 px gaps — thumb-friendly tap targets
- Grid cells are ~35×35 px — not tappable (no grid tap mechanic, only buttons)
- Portrait orientation throughout
- No landscape handling needed

## Known UX Issues
- **No board-clear animation:** When a board is solved, `nextBoard()` immediately calls `buildBoard()` with no transition delay or celebration animation — the grid just resets abruptly
- **No "ready" indicator:** After `startGame()`, the grid appears instantly with no countdown or prompt; players may accidentally waste moves
- **Active-button checkmark only:** The checkmark inside the active button is subtle — players may not notice the "same-color no-cost" rule
- **No undo:** There is no way to undo a mis-tap; one wrong move is permanent
- **No tutorial:** First-time players receive no in-game explanation beyond the menu subtitle "Flood fill the grid in 20 moves!"
