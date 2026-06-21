# Block Breaker — Test Report

## Static Analysis Findings

| Finding | Detail |
|---|---|
| Global exposure | Single `const BlockBreaker` — no namespace pollution beyond one identifier |
| Module pattern | ES6 IIFE-style object literal; no imports/exports; loaded via `<script>` tag |
| Line count | ~396 lines — compact and reviewable in one sitting |
| Build step | None; syntax can be verified with `node --check <file>.js` |
| Strict mode | Not explicitly declared; recommend adding `'use strict'` or wrapping in a module |
| No image assets | All art is canvas-drawn; no external fetch dependencies at runtime |
| localStorage usage | Single key `blockbreaker_best`; no JSON serialization — raw integer string |

No linter configuration is committed for this file. A one-off ESLint pass (es2020 env, browser globals) is recommended before portal submission to catch undeclared variables and unreachable branches.

## Functional Test Cases

| Test Case | Input | Expected | Status |
|---|---|---|---|
| Ball launch on tap | `tap()` called while state is `MENU` | Ball `stuck` flag set to `false`, state transitions to `PLAYING`, `gameplayStart()` called | Not verified |
| Paddle angle deflection | Ball contacts paddle at far-left edge (`relPos = -1`) | Ball exits at angle `-PI/3` (left); contact at center (`relPos = 0`) exits straight up | Not verified |
| Brick HP decrement | Non-fireball ball hits a row-0 brick (hp=3) | Brick `hp` decrements to 2; brick remains visible; `score` audio plays | Not verified |
| Powerup wide effect | `_applyPowerup('wide')` called | `_paddleW` increases by 36 (to 116); `_effects.wide` set to `now + 8000`; reverts after 8 s | Not verified |
| Multiball spawn | `_applyPowerup('multiball')` called with 1 ball active | 2 additional balls added to `_balls` (total 3); new balls launched at divergent angles | Not verified |
| Win condition trigger | Last brick destroyed during PLAYING | State transitions to `WIN`, `_winTimer` set to 1.5, `power` audio plays; after 1.5 s `_level` increments and PLAYING resumes | Not verified |

All cases are currently marked "Not verified" — the game has no automated test suite. A headless smoke-test script (similar to `orbit-hopper/smoke-test.js`) should be written to cover at minimum the first four cases before portal submission.

## Performance Notes

- **Particle system**: Particles are created on every brick hit. With 40 bricks on the initial grid and a fireball active, rapid full-grid clears could instantiate hundreds of particles in a single frame. Particle lifetime and pool size should be capped (recommend max 120 simultaneous particles with oldest-first eviction).
- **Multiple balls**: The `_balls` array grows unboundedly if multiball powerups stack. Each ball requires its own collision pass against all bricks each frame. With 3+ balls and 40 bricks, that is 120+ collision tests per frame — acceptable at 60 fps but worth profiling at higher levels when brick count is low and ball speed is high (up to 520 px/s).
- **Canvas state**: Each `draw()` call should save/restore canvas context state around brick, paddle, ball, and particle rendering to avoid transform or style leakage between draw phases.
- **`_winTimer` precision**: The 1.5 s countdown uses `dt` accumulation. Ensure `dt` is clamped (e.g. max 50 ms) to prevent a tab-hidden resume from skipping the WIN state entirely.

## Edge Cases

**Ball stuck in corner**: At high speed, a ball bouncing at a near-horizontal angle between the top wall and an indestructible surface can oscillate indefinitely. Mitigation: add a minimum vertical velocity component (e.g. `|vy| >= speed * 0.2`) and nudge the angle if violated.

**All lives lost simultaneously (multiball)**: If multiple balls exit the bottom of the screen in the same `update(dt)` tick, `_die()` may be called multiple times before `_lives` reaches 0. This can cause duplicate `showInterstitial` / `onRunEnd` calls. Mitigation: guard `_die()` with a `_dying` flag that is set on first invocation and cleared on restart.

**Powerup stacking**: Two wide tokens collected in succession both extend `_effects.wide` by 8 s from collection time. If the first token's 8 s is nearly expired when the second is caught, the second resets the full duration — this is desirable behavior. However, `_paddleW` must only be widened once (not doubled). Confirm `_applyPowerup('wide')` sets `_paddleW` to `PADDLE_W0 + 36` unconditionally, not `_paddleW + 36`, to prevent unbounded growth.

**Fireball + multiball interaction**: All balls in `_balls` should share the fireball state (since `_effects.fireball` is a global timestamp, not per-ball). Confirm `_hitBrick` reads `_effects.fireball` rather than a per-ball property so all active balls benefit equally from the powerup.
