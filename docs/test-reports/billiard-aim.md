# Billiard Aim — Test Report

## Static Analysis

- **Syntax check:** `node --check js/game.js` — expected pass (ES6 closures, no modules).
- **Global leakage:** Only `BilliardAim` exposed on `window`; physics state (`cueBall`, `targetBalls`) must be closure-private.
- **Canvas API usage:** 2D context only; no image loading, no WebGL.
- **No external dependencies:** Self-contained single file.
- **Numeric stability:** `FRICTION^(dt*60)` with variable `dt` — ensure `dt` is clamped to avoid large friction spikes on tab re-focus.

## Functional Test Table

| Test ID | Scenario | Expected Result | Risk |
|---|---|---|---|
| BA-01 | Tap on MENU | Transitions to PLAYING, `startGame()` called, `gameplayStart()` fired | High |
| BA-02 | First tap in PLAYING (`tapPhase=0`) | `aimAngle` set toward tap point, `tapPhase=1` | High |
| BA-03 | Second tap (`tapPhase=1`) | Cue ball impulse applied: `vx=cos(aimAngle)*12`, `vy=sin(aimAngle)*12`, `tapPhase=0` | High |
| BA-04 | Cue ball reaches rail | Velocity reflected with 0.75 restitution, `Audio.play('tap')` | High |
| BA-05 | Cue ball hits target ball | Elastic collision via `collideBalls()`, velocities exchanged along normal | High |
| BA-06 | Target ball enters pocket radius | `score++`, ball removed from `targetBalls`, `Audio.play('gem')` | High |
| BA-07 | Cue ball enters pocket radius | `lives--`, cue ball repositioned, `Audio.play('crash')` | High |
| BA-08 | `lives` reaches 0 | Game ends, `gameplayStop()` + `showInterstitial()` called | High |
| BA-09 | `timeLeft` reaches 0 | Game ends, same end-game sequence | High |
| BA-10 | All 6 target balls pocketed | `spawnTargetBalls()` resets all 6 — no game over | High |
| BA-11 | Ball speed < `MIN_SPEED` (0.8) | Ball velocity set to 0, stops moving | Medium |
| BA-12 | Tap on DEAD screen | State returns to MENU | Medium |
| BA-13 | `timeLeft` display turns red | Red color applied when `timeLeft <= 10` | Low |
| BA-14 | Two balls overlapping at spawn | `collideBalls()` must separate — verify spawn positions have minimum separation | Medium |
| BA-15 | `offerDoubleScore` on game end | `offerDoubleScore(score, 'billiardaim_best')` invoked | Medium |
| BA-16 | `localStorage` best score update | `billiardaim_best` updated if `score > best` | Medium |
| BA-17 | `aimPower=12` constant | No variation in shot speed regardless of tap position | Low |
| BA-18 | Flash overlay on pocket events | `flashTimer` set, `flashGood` correct boolean for pocket type | Low |

## Performance

- **Target:** 60 fps on mid-range mobile.
- **Rendering cost:** Moderate — 7 balls, 6 pockets, table geometry, aim line. All drawn as canvas paths.
- **Physics cost:** O(n²) ball-ball collision checks each frame; with n=7 (1 cue + 6 target) this is 21 pairs — negligible.
- **Friction computation:** `Math.pow(FRICTION, dt*60)` called every frame per ball — consider caching when `dt` is stable (fixed 60 fps).
- **Memory:** No dynamic allocation after `startGame()` except on `spawnTargetBalls()`.

## Edge Cases

| Case | Concern |
|---|---|
| `dt` spike on tab switch | `FRICTION^(dt*60)` could produce near-zero friction factor; clamp `dt` to max 0.05 |
| Cue ball and target ball spawn overlap | `collideBalls()` resolves but may cause jitter on frame 1; ensure spawn positions maintain `> 2*BALL_R` separation |
| All balls stop moving simultaneously | `tapPhase` should reset to 0 so next tap starts aiming, not shooting |
| Cue ball pocketed on same frame as target | Both `score++` and `lives--` should both trigger in same `checkPockets()` pass |
| `timeLeft` negative | Timer should clamp at 0 before triggering end condition, not go below 0 |
| Rail corner intersection | Ball moving into corner pocket vs. rail — pocket capture should take priority over rail bounce |
| `spawnTargetBalls()` when cue ball near center | New target ball spawn must not overlap cue ball position |
