# Arrow Dodge — Future Enhancements

## High Priority

### 1. Cooldown Visual Feedback
**Problem:** The 0.5s fire cooldown (`COOLDOWN_MAX`) is invisible to the player. Rapid tappers experience silent input rejection.
**Enhancement:** Render a shrinking arc or color pulse on the archer at `(archerX, archerY)` that fills to full as `cooldown` decrements to 0. Use the existing `cooldown / COOLDOWN_MAX` ratio as the fill fraction.

### 2. Wind Numeric Display
**Problem:** Wind grows to extreme values at high score tiers but is only shown as a directional icon.
**Enhancement:** Add a numeric label (e.g., `"← 34"` or `"→ 12"`) next to the wind indicator. Read directly from the `wind` variable. No new state needed.

### 3. Target Exit Particle Effect
**Problem:** Targets silently disappear when they exit the bottom edge, making life loss feel unpredictable.
**Enhancement:** Spawn a small burst of particles at the target's last position when it crosses `VH`. Reuse the `particles` pattern from Balance Beam if shared infrastructure is added.

## Medium Priority

### 4. Variable Target Count by Difficulty
**Problem:** Target count is fixed at 3. At high tiers the screen feels sparse relative to the difficulty of the wind.
**Enhancement:** Increase active target count from 3 to 4 at `score >= 90` and to 5 at `score >= 150`. Adjust spawning in `startGame()` and after `onArrowHit` to respect the current tier count.

### 5. Arrow Trail Rendering
**Enhancement:** Render a fading trail behind each arrow in `playerArrows` by storing the last N positions per arrow. Improves visual clarity of arrow paths, especially helpful when wind is high.

### 6. First-Run Tutorial Overlay
**Enhancement:** On the very first play (check `localStorage.getItem('arrowdodge_best') === null`), display a brief animated overlay: tap indicator pointing toward a target, plus a wind arrow. Dismiss on first tap.

### 7. Streak Bonus Scoring
**Enhancement:** Track consecutive hits without a life loss. Award a multiplier (e.g., ×1.5 at 5-hit streak) that resets on each `loseLife()`. Show streak counter in HUD.

## Low Priority

### 8. Color-Blind Accessible Target Differentiation
**Enhancement:** The 3 bullseye targets are distinguished by color. Add a secondary shape difference (e.g., ring count: 2, 3, 4 rings) so color-blind players can differentiate targets at a glance.

### 9. Wind Direction Transition Animation
**Problem:** Wind sign can flip abruptly at each 30-point threshold re-roll.
**Enhancement:** Lerp wind from old to new value over 1–2 seconds after each threshold crossing, giving players time to adapt.

### 10. Persistent Stats Screen
**Enhancement:** Add a stats panel accessible from MENU showing: total runs played, total targets hit, highest wind tier reached. Store in localStorage alongside `arrowdodge_best`.

### 11. Moving Archer (Advanced Mode)
**Enhancement:** Optional hard mode where the archer's X position drifts slowly, requiring players to account for both wind and archer position when aiming. Toggle via a settings icon on the MENU screen.
