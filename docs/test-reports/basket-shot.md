# Basket Shot — Test Report

## Static Analysis

- **Syntax check:** `node --check js/game.js` — expected pass (standard ES6, no modules).
- **Global leakage:** Only `BasketShot` should be exposed on `window`; all internal variables should be closure-scoped.
- **Canvas API usage:** Uses `CanvasRenderingContext2D` methods only — no WebGL, no image loading.
- **No external dependencies:** Self-contained; no `import`/`require`.

## Functional Test Table

| Test ID | Scenario | Expected Result | Risk |
|---|---|---|---|
| BS-01 | Tap on MENU screen | Transitions to PLAYING, `startGame()` called, `gameplayStart()` fired | High |
| BS-02 | Tap with ball not in flight | `ballInFlight=true`, velocity set via `ballVX=dx/t`, `ballVY=dy/t-0.5*GRAV*t` | High |
| BS-03 | Ball passes through hoop band at correct X | `score++`, `flashGood=true`, `Audio.play('gem')` | High |
| BS-04 | Ball passes through hoop at wrong X | `lives--`, `flashGood=false`, `Audio.play('crash')` | High |
| BS-05 | Ball exits canvas without scoring | Miss detected, `lives--` | High |
| BS-06 | Tap while `ballInFlight=true` | No action — tap ignored | Medium |
| BS-07 | `lives` reaches 0 | State transitions to `DEAD`, `gameplayStop()` + `showInterstitial()` called | High |
| BS-08 | Tap on DEAD screen | `state='MENU'` — no restart, returns to menu | Medium |
| BS-09 | `score=1` | `hoopSpeed = min(260, 130)` = 130 px/s | Medium |
| BS-10 | `score=14` | `hoopSpeed = min(260, 260)` = 260 px/s (capped) | Medium |
| BS-11 | Hoop reaches canvas edge | `hoopDir` flips sign | High |
| BS-12 | `ballRot` increments during flight | Ball visually spins | Low |
| BS-13 | Flash overlay fades | `flashTimer` decrements each frame to 0 | Low |
| BS-14 | Stars rendered | 40 star objects visible in MENU and PLAYING states | Low |
| BS-15 | `localStorage.getItem('basketshot_best')` after high score | Returns new best as string | Medium |
| BS-16 | `offerDoubleScore` called on DEAD | Ad SDK `offerDoubleScore(score, 'basketshot_best')` invoked | Medium |
| BS-17 | Trajectory arc rendered pre-flight | Dotted arc visible when `!ballInFlight` | Medium |
| BS-18 | Trajectory arc hidden during flight | Arc not rendered when `ballInFlight=true` | Medium |

## Performance

- **Target:** 60 fps on mid-range mobile.
- **Rendering cost:** Low — single ball, single hoop, 40 stars, dotted arc (discrete segments). No image decoding.
- **Physics cost:** Constant-time per frame — single projectile with gravity, no collision detection between multiple objects.
- **Particle systems:** None — flash is a full-canvas rectangle with alpha, negligible cost.
- **Memory:** No frame-to-frame allocation expected after init (stars array, no dynamic spawning).

## Edge Cases

| Case | Concern |
|---|---|
| Tap exactly on hoop center | Should always score; verify hoop X range check includes center position |
| `dist=0` (tap on ball position) | `t = 0.7 + 0/900 = 0.7`; `dx=0, dy=0` → ball fires straight up; no crash but unintuitive |
| Ball leaves top of canvas | Must be treated as miss, not hang in flight indefinitely |
| Rapid taps during flight | All taps while `ballInFlight=true` must be discarded |
| `localStorage` unavailable (private mode) | `getItem`/`setItem` should be wrapped in try/catch or gracefully fail |
| `hoopSpeed` at cap (score≥14) | No further acceleration; verify `min(260, ...)` is always applied |
| Very tall device (VH > 844) | `hoopY=160` fixed — hoop always near top regardless of canvas scaling |
