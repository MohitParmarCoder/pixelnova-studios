# Billiard Aim — Codebase Reference

## Overview
Billiard Aim is a single-file HTML5 canvas billiards game where the player uses a two-tap aim-then-shoot system to pocket colored target balls before time runs out. Physics simulation includes friction, elastic ball-ball collisions, and rail bounces.

## File: js/game.js
- **Lines:** ~549
- **Global namespace:** `BilliardAim`
- **Canvas size:** 390×844 virtual px

## State Machine

```
MENU → PLAYING → DEAD
```

- `MENU`: Title screen; tap to start.
- `PLAYING`: Active gameplay with timer countdown, two-tap shooting system.
- `DEAD`: Game over (time or lives exhausted); tap returns to `MENU`.

## Core Variables

| Variable | Description |
|---|---|
| `score` | Balls pocketed this run |
| `lives` | Remaining lives, starts at 3; lost when cue ball is pocketed |
| `timeLeft` | Countdown timer, starts at 60 s; game ends at 0 |
| `cueBall` | Object `{x, y, vx, vy}` for the white cue ball |
| `targetBalls` | Array of 6 colored ball objects `{x, y, vx, vy, color}` |
| `pockets` | Array of 6 pocket positions at table corners and midpoints |
| `TABLE` | Table bounds: `{x:30, y:100, w:330, h:544}` |
| `BALL_R` | Ball radius: 14 px |
| `POCKET_R` | Pocket capture radius: 20 px |
| `FRICTION` | Per-frame friction coefficient: 0.985 |
| `MIN_SPEED` | Speed threshold below which ball stops: 0.8 px/s |
| `tapPhase` | `0` = aim phase (first tap sets angle), `1` = shoot phase (second tap fires) |
| `aimAngle` | Current aim direction in radians |
| `aimPower` | Shot impulse magnitude: 12 (constant) |
| `flashTimer` | Countdown for visual feedback overlay |
| `flashGood` | Boolean — green on pocket, red on cue-ball pocketed |

## Key Functions

- **`startGame()`** — Resets score, lives, timer, spawns cue ball and 6 target balls, calls `gameplayStart()`.
- **`tap(x, y)`** — Phase 0: compute `aimAngle = atan2(y - cueBall.y, x - cueBall.x)`, advance to phase 1. Phase 1: apply impulse `cueBall.vx = cos(aimAngle)*aimPower`, `cueBall.vy = sin(aimAngle)*aimPower`, reset to phase 0.
- **`update(dt)`** — Decrements `timeLeft`, applies friction `vel *= FRICTION^(dt*60)`, stops balls below `MIN_SPEED`, calls `collideBalls()`, checks pocket captures, detects end conditions.
- **`collideBalls()`** — Elastic collision resolution between all ball pairs; separates overlapping balls then exchanges velocity components along collision normal.
- **`railBounce(ball)`** — Reflects ball velocity on table edges with 0.75 restitution coefficient.
- **`checkPockets()`** — Tests each ball against each pocket; target balls pocketed increment score; cue ball pocketed decrements lives and repositions cue ball.
- **`spawnTargetBalls()`** — Re-populates all 6 target balls when all have been pocketed (wave clear).
- **`draw()`** — Renders table felt, rails, pockets, balls, aim line (phase 0), HUD (score, timer, lives). Timer shown red when `timeLeft <= 10`.

## Difficulty Scaling

No explicit difficulty scaling — `aimPower` is constant and speed does not increase. Difficulty emerges naturally as fewer target balls remain on table. Wave-clear resets all 6 targets.

## localStorage Keys

| Key | Content |
|---|---|
| `billiardaim_best` | All-time high score (integer) |

## Dependencies

- **Audio:** `Audio.play('tap')` on rail bounce, ball-ball collision, and aim-tap; `Audio.play('gem')` on target ball pocketed; `Audio.play('crash')` on cue ball pocketed.
- **Ads:** `gameplayStart()` in `startGame()`; `gameplayStop()` + `onRunEnd()` + `showInterstitial()` on game end (time or lives); `offerDoubleScore(score, 'billiardaim_best')` on game over.
