# Block Breaker — Codebase Reference

## Overview

Block Breaker is a self-contained HTML5 canvas Arkanoid clone implemented as a single ES6 module. All game logic, rendering, physics, and state management live in one file with no build step. The game exposes a single global constant (`BlockBreaker`) consumed by a thin host page responsible for the canvas, audio, and ad scaffolding.

## File Info

| Property | Value |
|---|---|
| Global name | `BlockBreaker` (ES6 `const`) |
| Approximate line count | ~396 |
| Language | Vanilla ES6 JavaScript |
| Build step | None — loaded directly via `<script>` tag |

## State Machine

```
MENU
 └─ tap() ──────────────────────────────► PLAYING
                                            │
                              all bricks     │  lives reach 0
                              cleared        ▼
                         WIN ◄──────── PLAYING ──────────► DEAD
                          │
                _winTimer=1.5s
                          │
                          └──────────────► PLAYING (next level)
```

| State | Entry condition | Exit condition |
|---|---|---|
| `MENU` | Initial / after DEAD | `tap()` called |
| `PLAYING` | After `tap()` or after WIN timer | All bricks cleared (→ WIN) or all lives lost (→ DEAD) |
| `WIN` | All bricks cleared | `_winTimer` (1.5 s) elapses → next level begins |
| `DEAD` | `_lives` reaches 0 | `tap()` called → MENU |

## Key Variables

| Name | Type / Default | Purpose |
|---|---|---|
| `_score` | number / 0 | Accumulated points this session |
| `_lives` | number / 3 | Remaining lives; DEAD when 0 |
| `_level` | number / 1 | Current level; increments on WIN |
| `_bricks` | Array (5 rows × 8 cols) | Grid of bricks, each with `hp` field |
| `ROW_HP` | `[3,3,2,1,1]` | Hit points per row (top → bottom) |
| `_balls` | Array of `{x,y,vx,vy,stuck}` | Active balls; `stuck=true` while held on paddle |
| `_paddleX` | number | Horizontal center of the paddle |
| `_paddleW` | number / `PADDLE_W0` (80) | Current paddle width |
| `_powerups` | Array | Falling powerup tokens |
| `_effects` | `{wide:t, fireball:t}` | Active timed effect expirations (timestamps) |
| `_winTimer` | number / 0 | Countdown (1.5 s) between WIN and next level |
| `_particles` | Array | Visual particle objects for hit effects |
| `BALL_SPD0` | 320 | Base ball speed (px/s) |
| `BALL_SPD_MAX` | 520 | Speed cap across all levels |
| `PADDLE_Y` | 790 | Fixed vertical position of the paddle |
| `PADDLE_W0` | 80 | Default (non-buffed) paddle width |

## Key Functions / Methods

| Function | Description |
|---|---|
| `init(canvas, audio, ads)` | Wires up canvas/context, audio and ad manager references, resets all state |
| `update(dt)` | Main game loop tick: moves balls, checks collisions, updates particles, counts down `_winTimer` |
| `draw(ctx)` | Renders all game elements: bricks, paddle, balls, powerups, particles, HUD |
| `setPaddleX(vx)` | Sets paddle center directly (used by drag input); clamps to canvas bounds |
| `nudge(dx)` | Translates paddle by `dx` pixels; also moves a stuck ball with the paddle |
| `tap()` | Launches held ball (MENU → PLAYING) or restarts (DEAD → MENU); fires `gameplayStart` ad call |
| `getScore()` | Returns `_score` |
| `getState()` | Returns current state string (`'MENU'`, `'PLAYING'`, `'WIN'`, `'DEAD'`) |
| `getBest()` | Reads `blockbreaker_best` from localStorage |
| `_ballSpeed()` | Computes current ball speed: `min(BALL_SPD_MAX, BALL_SPD0 + (_level-1) * 15)` |
| `_spawnBricks()` | Populates `_bricks` grid for the current level using `ROW_HP` |
| `_die()` | Decrements `_lives`, triggers `lose` audio, fires `gameplayStop`, `onRunEnd`, `showInterstitial` |
| `_hitPaddle(ball)` | Reflects ball; sets angle from relative paddle contact: `angle = relPos * PI/3` |
| `_hitBrick(ball, brick)` | Decrements brick `hp`; destroys brick at 0, awards points, may spawn powerup |
| `_applyPowerup(type)` | Activates wide, fireball, or multiball effect |

## Difficulty Scaling

Ball speed increases with level via `_ballSpeed()`:

```
speed = min(BALL_SPD_MAX, BALL_SPD0 + (_level - 1) * 15)
     = min(520, 320 + (_level - 1) * 15)
```

Score per brick destroyed:

```
points = 10 + (ROWS - 1 - row) * 4 * _level
```

Top rows (high `hp`) award more points; deeper levels multiply the bonus.

## localStorage Key

| Key | Content |
|---|---|
| `blockbreaker_best` | All-time high score (integer, serialized as string) |

## External Dependencies

| Module | Used for |
|---|---|
| `Audio` | Playing sound cues: `tap`, `score`, `gem`, `lose`, `power`, `button` |
| `AdManager` | `gameplayStart()`, `gameplayStop()`, `onRunEnd()`, `showInterstitial()`, `offerDoubleScore()` |
| `Input` | Pointer/drag events translated to `setPaddleX` / `nudge` / `tap` calls by the host page |
