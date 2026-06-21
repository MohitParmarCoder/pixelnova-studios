# Block Breaker — Usability Report

## Controls

| Action | Input |
|---|---|
| Move paddle | Single-finger drag (or mouse drag) → `setPaddleX(vx)` |
| Fine adjustment | Swipe with small delta → `nudge(dx)` |
| Launch ball | Tap anywhere → `tap()` |
| Restart after death | Tap anywhere on DEAD screen → `tap()` returns to MENU |

The control surface is intentionally minimal: one finger moves the paddle, one tap launches. There is no on-screen button to tap for launch — any tap anywhere works, which removes a precision requirement at the moment of highest tension.

## Learning Curve

Block Breaker's Arkanoid heritage means a large portion of players arrive with an intuitive mental model: bounce the ball, don't let it fall, break all bricks. First-time players without that background must infer the rules from observation alone, as there is no tutorial screen or text instructions during gameplay.

The held-ball mechanic (ball starts stuck to the paddle until tap) gives new players a moment to aim before committing. Paddle angle deflection (contact position maps to exit angle) follows the Arkanoid convention that experienced players expect, but is not explained anywhere in the UI.

Difficulty ramp is gentle at launch (speed 320 px/s) and increases only 15 px/s per level, giving players several levels to internalize the physics before the pace becomes demanding.

## Visual Feedback

- **Particles** emit on every brick hit, providing immediate tactile confirmation that the ball connected.
- **Powerup drops** fall visibly from destroyed bricks; players must intercept them with the paddle, making the reward interactive rather than automatic.
- **HUD hearts** (top-left) give a persistent, glanceable life count. Score is displayed top-center and updates in real time. Level number appears top-right as 'LV N'.
- **Wide effect** visually lengthens the paddle, providing direct feedback that the powerup is active.
- **Fireball effect** should visually distinguish the ball (e.g. color change) so the player knows one-hit destruction is active.
- **WIN state** provides a 1.5-second pause before the next level loads, giving the player a moment of acknowledgment before difficulty resets upward.

## Accessibility Notes

- There are no text-only instructions during gameplay. Players who cannot infer rules from visual observation have no alternative guidance path.
- Powerup type differentiation likely relies on color alone. Players with color vision deficiencies may not be able to distinguish wide, fireball, and multiball tokens without additional shape/icon differentiation.
- No pause functionality is documented. A player who needs to interrupt a session mid-level loses progress on that level.
- No adjustable text size or contrast settings are present.
- Audio cues (`tap`, `score`, `gem`, `lose`) provide a secondary feedback channel beyond visuals, which benefits players who track audio to confirm hits.

## Mobile UX

- Single-finger drag is the primary control — well-suited to portrait mobile play.
- The canvas is presumably scaled to fill the viewport (consistent with the project's letterboxing pattern). At small screen sizes, the 80 px default paddle width may feel narrow relative to the rendered canvas.
- Touch latency is the primary concern: `setPaddleX` must be called on every `touchmove` event with minimal debouncing to keep the paddle responsive. Any frame-rate drop will make the paddle feel sticky.
- No multi-touch handling is specified; accidental second-finger contact could interfere with paddle dragging on some devices.

## UX Issues and Recommendations

**Issue 1: No powerup type labeling.**
Powerup tokens drop from bricks but their type (wide, fireball, multiball) must be communicated by color or icon alone. Recommendation: render a small icon or letter on each token (W / F / M) to make type identification instantaneous regardless of color perception.

**Issue 2: No pause or resume.**
There is no documented pause mechanic. On mobile, an incoming call or notification during an active game results in losing a life (ball drops uncaught). Recommendation: pause the game loop on `visibilitychange` (page hidden) and resume on return, matching the Orbit Hopper pattern already used in this project.

**Issue 3: Ball loss is silent in multi-ball scenarios.**
When multiple balls are active and one falls off-screen, the player loses a life — but if other balls remain in play, the visual disruption is minimal and the life deduction may go unnoticed. Recommendation: play the `lose` audio cue and briefly flash the hearts HUD when a life is lost regardless of remaining ball count, so the player is always aware.

**Issue 4: No "how to play" screen.**
First-time players who are unfamiliar with Arkanoid have no in-game resource. Recommendation: add a single-screen INFO state (accessible from MENU) that shows the three powerup types, the angle-deflection mechanic, and the multiball mechanic using simple canvas-drawn diagrams — no text required, consistent with the no-words-in-gameplay constraint.

**Issue 5: Paddle width defaults to 80 px in virtual canvas space.**
Depending on the virtual canvas resolution, 80 px may be too narrow for comfortable first-level play, especially on small physical screens. Recommendation: consider a first-level bonus width (e.g. 100 px) that narrows to 80 px from level 2 onward, giving new players a more forgiving introduction.
