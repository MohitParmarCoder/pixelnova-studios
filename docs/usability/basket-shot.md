# Basket Shot — Usability Report

## Controls

| Action | Input |
|---|---|
| Shoot ball | Tap anywhere on canvas |
| Navigate DEAD → MENU | Tap anywhere |

Controls are single-touch only. No swipe, drag, or hold mechanics.

## Learning Curve

**Immediate comprehension:** The dotted trajectory preview arc shown before each shot communicates the aim-and-shoot mechanic without any tutorial text. Players understand within 1–2 shots.

**Ramp:** The hoop starts at a forgiving speed (120 px/s). Difficulty ramps gradually with `hoopSpeed = min(260, 120 + score*10)`, so new players get several successful baskets before the hoop becomes hard to track.

**Ceiling:** At high scores the hoop moves at 260 px/s and only a narrow window of timing is viable. Skilled players can use the preview arc to time shots to intercept the hoop mid-travel.

## Visual Feedback

- **Flash overlay:** Full-canvas green flash (`flashGood=true`) on basket scored; red flash on miss. `flashTimer` drives fade-out duration.
- **Ball rotation:** `ballRot` increments during flight to imply spin, giving life to the projectile.
- **Trajectory arc:** Dotted preview rendered when `!ballInFlight` — directly tied to tap-point position, so players see the exact predicted path before committing.
- **Hearts HUD:** 5 heart icons top-left visually communicate remaining lives at a glance. No numeral needed.
- **Score:** Rendered center-top in large font; prominent and always readable.

## Accessibility

- No color-only information: hearts are iconic (shape), flash uses full-screen coverage (not subtle hue shifts).
- No time limit — players can wait indefinitely between shots.
- No text required to understand core play loop (trajectory arc + heart icons are self-explanatory).
- No audio dependency: all feedback has a visual counterpart.

## Mobile UX

- Single-tap interaction is fully compatible with touchscreens.
- 390 px virtual width matches common portrait phone viewport.
- Hoop and ball are large enough (hoopW=70, ballR=22) to be visible on small screens.
- No small tap targets in the HUD that must be precisely hit.

## UX Issues / Improvement Opportunities

1. **No restart shortcut from DEAD screen:** Players must tap to go to MENU, then tap again to start. A direct "tap to retry" on the DEAD screen would reduce friction.
2. **No feedback for near-misses:** A ball that clips the rim with no visual distinction from a clean miss feels arbitrary; a rim-hit animation would improve clarity.
3. **No high-score display on DEAD screen:** Players see their score go to MENU before seeing the best score comparison, breaking the reward loop.
4. **Preview arc disappears on shoot:** The arc vanishes the instant the ball launches, so players cannot compare the predicted path to the actual trajectory during flight — useful for learning correction.
5. **No mute toggle in-game:** Audio can only be controlled outside the game context; a single-tap mute icon in the HUD corner would be user-friendly.
