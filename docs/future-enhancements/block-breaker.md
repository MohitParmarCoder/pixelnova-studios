# Block Breaker — Future Enhancements

## Priority Definitions

| Priority | Meaning |
|---|---|
| P1 | Critical or quick win — do before next portal submission |
| P2 | High value — strong player retention or revenue impact |
| P3 | Nice to have — polish and differentiation |
| P4 | Long term — significant scope, plan for a later milestone |

## P1 — Critical / Quick Wins

**Pause on visibility change**
When the browser tab is hidden (phone call, notification, app switch), the game loop should pause automatically and resume when the tab returns to focus. Without this, players lose lives to events outside their control, creating frustration. Implementation: listen for `document.visibilitychange`; set a `_paused` flag; skip `update(dt)` while paused. Effort: ~1 hour.

**Sound / mute toggle in MENU**
A persistent mute toggle (stored in localStorage as `blockbreaker_muted`) lets players silence the game without relying on device-level controls. This is a hygiene feature expected by portal reviewers and players alike. The pattern is already established in Orbit Hopper (`orbit_muted`). Effort: ~2 hours including the settings icon drawn in canvas.

## P2 — High Value

**Shield powerup**
A fourth powerup type that places a temporary barrier across the bottom of the screen, preventing one ball from falling through. Adds a defensive risk-reward layer: do you chase the shield token or stay under the ball? Visually distinct from wide/fireball/multiball; draws as a horizontal line segment with a distinct color. Effect duration: ~5 seconds. Effort: 1 day.

**Online leaderboard**
Persist the top 10 all-time scores server-side (a lightweight REST endpoint or a third-party leaderboard service such as GameDistribution's built-in scores API). Display on a SCORES state accessible from MENU. Adds replay motivation and social competition. Requires a backend endpoint or third-party SDK integration. Effort: 2–3 days.

**Laser powerup**
A timed powerup that arms the paddle with a laser cannon. Tap (when a ball is already in play) fires a laser beam upward that destroys the first brick it hits regardless of HP. Gives players agency during high-difficulty levels when ball control is hardest. Visual: thin vertical beam drawn each frame the laser is active. Effort: 1–2 days.

## P3 — Nice to Have

**Haptic feedback on mobile**
Call `navigator.vibrate(20)` on brick hit and `navigator.vibrate([30,20,30])` on life lost. Adds tactile satisfaction with zero visual overhead. Guard with feature detection (`if (navigator.vibrate)`). Effort: ~30 minutes.

**Boss bricks**
Introduce a special brick type every 5 levels that requires 6+ hits and drops a guaranteed powerup on destruction. Boss bricks are drawn with a distinct sprite pattern (canvas-drawn cracks or pulsing color). Adds a mid-level high-value target that shifts player strategy. Effort: 2 days.

**Per-level color themes**
Cycle the brick color palette and background tint each level (e.g. blues → greens → reds → purples). Purely cosmetic but makes level progression feel more rewarding. Store a `THEMES` array of color sets; pick by `(_level - 1) % THEMES.length`. Effort: ~2 hours.

## P4 — Long Term

**Level editor**
An in-game canvas-based tool that lets players design custom brick layouts, save them to localStorage as JSON, and share them via a URL hash. Dramatically extends content longevity without requiring developer-authored levels. Requires a new EDITOR state with click-to-toggle brick cells, a palette for HP selection, and an export/import mechanism. Effort: 1–2 weeks.

## Effort Summary Table

| Enhancement | Priority | Effort | Impact |
|---|---|---|---|
| Pause on visibility change | P1 | 1 hour | High — prevents unfair life loss |
| Sound / mute toggle | P1 | 2 hours | High — portal hygiene requirement |
| Shield powerup | P2 | 1 day | Medium — gameplay depth |
| Online leaderboard | P2 | 2–3 days | High — retention and social |
| Laser powerup | P2 | 1–2 days | Medium — gameplay variety |
| Haptic feedback | P3 | 30 minutes | Low-medium — mobile polish |
| Boss bricks | P3 | 2 days | Medium — content variety |
| Per-level color themes | P3 | 2 hours | Low — cosmetic polish |
| Level editor | P4 | 1–2 weeks | Very high (long term) — UGC content |
