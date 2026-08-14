# Memory Flip — Usability Report

## Controls
- **Primary mechanic:** Single tap on a card to flip it; tap a second different card to attempt a match
- **State navigation:** Tap anywhere on MENU screen to start; tap on DEAD screen to retry (triggers interstitial); tap during WIN banner fast-forwards to next level
- **Keyboard support:** None — the public API only exposes `tap(vx, vy)` with virtual canvas coordinates

## Learning Curve
The mechanic is universally understood (classic concentration/pairs). The on-screen title says "Match all the pairs!" and the MENU shows a sample symbol row, so the objective is clear before play begins. New players may briefly be confused by the 0.6-second mismatch hold (cards stay flipped before flipping back), but this is standard for the genre and teaches itself within two or three attempts.

## Visual Feedback
- **Score display:** Centred at y=24, bold white 30 px — immediately prominent
- **Level display:** Top-left corner, `LEVEL {n}` in semi-transparent 15 px text
- **Moves display:** Top-right corner, `MOVES {n}` in semi-transparent 15 px text
- **Timer bar:** Full-width progress bar at y=78 (height 16 px); colour transitions from green (`#2bff88`) above 50% → yellow (`#ffd23b`) 25–50% → red (`#ff3b6b`) below 25%; neon glow matches bar colour; seconds label below bar
- **Card flip animation:** Horizontal cosine-scale flip over ~0.18 s; symbol appears once `flip >= 0.5`; `?` on back with cyan glow
- **Match pulse:** `pulse` property (1 → 0 over 0.4 s) expands card border glow and lineWidth on matched pairs; colour switches to the symbol's own colour
- **Mismatched pair:** Holds face-up for 0.6 s (`MISMATCH_HOLD`) then animates back down — clear visual cause-and-effect
- **Level WIN banner:** Semi-transparent overlay with `LEVEL CLEAR!` in green (`#2bff88`) with neon glow; current score shown
- **DEAD overlay:** Semi-transparent overlay, `TIME UP!` in red (`#ff3b6b`) with glow, score, best, and pulsing `TAP TO RETRY`
- **No explicit particle system** — the `pulse` glow effect on matched cards serves as the celebratory feedback

## Accessibility Notes
- All symbols are geometric canvas paths in distinct colours (star=yellow, heart=red, circle=cyan, triangle=green, diamond=purple, square=orange, bolt=yellow, moon=light-blue, cross=pink, ring=teal) — colour and shape both encode identity, so colourblind players can still distinguish pairs
- One-handed playability: excellent — single tap to interact, no dragging or simultaneous input required
- Session length: short (60 s per level); runs are 1–5 minutes depending on level count reached

## Mobile Optimization
- Virtual canvas is exactly 390×844 — matches the iPhone 14 viewport; host scales via CSS letterboxing
- Card sizes computed dynamically (`cardW` capped at 80, aspect ~1:1.2) to fit any level grid without overflow
- Tap hit area matches the full card rectangle `(cd.x, cd.y, cd.x+cd.w, cd.y+cd.h)` — generous for 4×4 at ~80×96 px per card

## Known UX Issues
- **Taps ignored during mismatch hold:** `if (resolveTimer > 0) return;` blocks all taps — players who quickly tap another card will get no response and no feedback explaining why. A brief visual cue (e.g. flashing the locked cards) would help.
- **5×6 grid (level 4+) card size shrinks:** At `5×6` with `gap=12`, cards become narrower than the 80 px cap; symbol rendering scales down proportionally but may feel cramped on smaller phones.
- **WIN state tap detection is inconsistent:** During WIN, any tap sets `winTimer = 0` which immediately triggers the level transition in the next `update()` call — the interstitial for the run is not shown between levels, only at game-over.
- **No tutorial or first-run hint:** The instruction "Match all the pairs!" on the menu is the only guidance; there is no demo flip or animated card preview.
