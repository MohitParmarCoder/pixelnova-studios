# Basket Shot — Codebase Reference

## Overview
Basket Shot is a single-file HTML5 canvas basketball game where the player taps to shoot a ball through a moving hoop. The hoop accelerates as the score increases, creating a progressive difficulty curve.

## File: js/game.js
- **Lines:** ~472
- **Global namespace:** `BasketShot`
- **Canvas size:** 390×844 virtual px

## State Machine

```
MENU → PLAYING → DEAD
DEAD → MENU  (on tap)
```

- `MENU`: Title screen, waiting for first tap to start.
- `PLAYING`: Active gameplay — ball shoots, hoop moves, score/lives tracked.
- `DEAD`: Game over screen displayed; any tap returns to `MENU` (sets `state='MENU'`).

## Core Variables

| Variable | Description |
|---|---|
| `score` | Current score (increments on successful basket) |
| `lives` | Remaining lives, starts at 5; displayed as hearts top-left |
| `hoopX` / `hoopY` | Hoop position; `hoopY` is fixed at 160 |
| `hoopW` | Hoop width: 70 px |
| `hoopDir` | Current horizontal direction of hoop movement (±1) |
| `hoopSpeed` | Hoop speed in px/s; starts at 120, capped at 260 |
| `ballX` / `ballY` | Ball position |
| `ballVX` / `ballVY` | Ball velocity components |
| `ballR` | Ball radius: 22 px |
| `ballInFlight` | Boolean — true while ball is airborne |
| `ballLanded` | Boolean — true after ball resolves (score or miss) |
| `ballRot` | Ball rotation angle for spin visual |
| `flashTimer` | Countdown for flash feedback overlay |
| `flashGood` | Boolean — green flash on score, red flash on miss |
| `GRAV` | Gravity constant: 900 px/s² |
| `stars` | Array of 40 background star objects |

## Key Functions

- **`startGame()`** — Resets score, lives, ball state, calls `gameplayStart()`.
- **`tap(x, y)`** — If ball not in flight: computes flight time as `t = 0.7 + dist/900`, sets `ballVX = dx/t`, `ballVY = dy/t - 0.5*GRAV*t`, launches ball.
- **`update(dt)`** — Advances hoop position, applies gravity to ball (`ballVY += GRAV*dt`), checks scoring/miss conditions.
- **`checkScore()`** — Detects when ball passes through the hoop band (`netTop` to `netBot+30`) within the correct X range; increments score, triggers `flashGood`.
- **`checkMiss()`** — Detects ball leaving play without scoring; decrements lives, triggers `flashTimer` with `flashGood=false`; if `lives<=0` transitions to `DEAD`.
- **`draw()`** — Renders stars, hoop (rim + net), ball with rotation, trajectory preview arc, HUD (score, hearts, flash overlay).
- **`drawTrajectory()`** — Dotted arc preview shown when `!ballInFlight`; simulates projectile path from current tap target.

## Difficulty Scaling

```
hoopSpeed = min(260, 120 + score * 10)
```

Speed increases by 10 px/s per point scored, capped at 260 px/s. No other difficulty axes scale.

## localStorage Keys

| Key | Content |
|---|---|
| `basketshot_best` | All-time high score (integer) |

## Dependencies

- **Audio:** Calls `Audio.play('tap')` on shoot, `Audio.play('gem')` on basket scored, `Audio.play('crash')` on life lost.
- **Ads:** `gameplayStart()` in `startGame()`; `gameplayStop()` + `onRunEnd()` + `showInterstitial()` when `lives<=0`; `offerDoubleScore(score, 'basketshot_best')` on game over.
