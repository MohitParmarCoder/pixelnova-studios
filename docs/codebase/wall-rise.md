# Wall Rise — Codebase Reference

## Overview

Wall Rise is an HTML5 canvas game where the player taps columns to remove bricks before any column reaches the top. Bricks continuously rise from the bottom; the player scores by clearing them, with multiplier bricks granting larger bonuses. The game ends when any column accumulates MAX_BRICKS bricks.

- Global object: `WallRise`
- Entry point: `js/game.js` (IIFE, exposes `WallRise`)
- Canvas virtual resolution: 390 x 844 px
- No build step — served as static HTML

## File: js/game.js

Single IIFE containing all game logic, rendering, and state management. Exposes the `WallRise` global with the following public surface:

```
WallRise.init(canvas, ctx)   — called once by main.js at startup
WallRise.update(dt)          — called each rAF tick with clamped dt
WallRise.draw()              — called each rAF tick after update
WallRise.tap(x, y)          — called by input.js on pointer down
WallRise.getState()          — returns current state string
WallRise.getScore()          — returns current numeric score
```

## State Machine

```
MENU ──tap──► PLAYING ──any column hits MAX_BRICKS──► DEAD
  ▲                                                      │
  └──────────────── tap on DEAD screen ─────────────────┘
```

- **MENU**: draws title, best score, tap-to-start prompt. Idle animation may show columns slowly filling.
- **PLAYING**: active gameplay — bricks rise on `riseInterval`, player taps columns.
- **DEAD**: game-over overlay with final score, best score, restart/double-score buttons.

State transitions are guarded; no transition fires while an animation is mid-flight.

## Core Variables

| Variable | Type | Description |
|---|---|---|
| `state` | string | Current state: `'MENU'`, `'PLAYING'`, `'DEAD'` |
| `cols` | Array(6) | Each element: array of brick objects in that column |
| `score` | number | `floor(elapsed * 8) + bonusScore` |
| `bonusScore` | number | Accumulated tap bonuses |
| `elapsed` | number | Seconds since `_startGame()` |
| `riseInterval` | number | Seconds between automatic brick rises; starts at 2.2 |
| `riseTimer` | number | Countdown to next rise step |
| `diffStep` | number | Count of rise steps taken; used to compute `riseInterval` |
| `MAX_BRICKS` | const | Column height limit (game-over threshold) |
| `COLS` | const | 6 |
| `BRICK_H` | const | 44 px |
| `COL_W` | const | 60 px (`floor((390 - 4*(6+1)) / 6)`) |
| `TOP_MARGIN` | const | 100 px |
| `BOTTOM_MARGIN` | const | 120 px |
| `particles` | Array | Active particle objects `{x,y,vx,vy,life,color}` |
| `scoreAnims` | Array | Floating score text animations `{x,y,val,life}` |

### Brick Object Schema

```js
{
  mult: 1 | 2 | 3,   // multiplier (controls color and bonus)
  y: number           // current top-y in canvas coords (updated each rise)
}
```

Brick spawn chances: `3x` = 12%, `2x` = 16%, `1x` = 72%.

## Key Functions

### `_startGame()`
Resets all columns to empty, resets `elapsed`, `bonusScore`, `riseInterval` to 2.2, `riseTimer` to `riseInterval`, sets `state = 'PLAYING'`, calls `AdManager.gameplayStart()`.

### `_riseStep()`
Pushes a new brick onto every column (bottom), increments `diffStep`, recalculates `riseInterval`:
```
riseInterval = max(0.55, 2.2 * 0.97^diffStep)
```
Checks each column length against `MAX_BRICKS`; if any column is full, calls `_endGame()`.

### `_tap(colIndex)`
Called from `tap(x, y)` after hit-testing column bounds. Removes the topmost brick from `colIndex`, computes bonus (`mult * 10` for 1x→10, 2x→60 wait — actually: 1x=+10, 2x=+60, 3x=+150 per spec), adds to `bonusScore`, spawns 8 particles, spawns score animation, plays audio (`'gem'` for 2x/3x, `'tap'` for 1x).

### `_endGame()`
Sets `state = 'DEAD'`, records best score to `localStorage`, calls `AdManager.gameplayStop()` then `AdManager.onRunEnd()`.

### `update(dt)`
```
dt = min(dt, 0.05)   // clamp
if PLAYING:
  elapsed += dt
  riseTimer -= dt
  if riseTimer <= 0: _riseStep(); riseTimer = riseInterval
  update particles
  update scoreAnims
```

### `draw()`
Draws background, column lanes, bricks (colored by multiplier, danger tint when column > 60% full), particles, score animations, HUD (score, elapsed, column indicators).

Danger tint: when `col.length / MAX_BRICKS > 0.6`, a semi-transparent red overlay is drawn over that column's lane.

Brick colors: 1x = grey-blue, 2x = amber, 3x = magenta.

## Difficulty Scaling

| diffStep | riseInterval (approx) |
|---|---|
| 0 | 2.20 s |
| 10 | 1.63 s |
| 20 | 1.21 s |
| 30 | 0.90 s |
| 40 | 0.66 s |
| 46+ | 0.55 s (floor) |

Formula: `riseInterval = max(0.55, 2.2 * Math.pow(0.97, diffStep))`

Score formula: `score = Math.floor(elapsed * 8) + bonusScore`

The time-based component rewards survival; the bonus component rewards active play (especially hunting 2x/3x bricks).

## localStorage Keys

| Key | Value |
|---|---|
| `wallrise_best` | Highest score achieved (integer string) |

## Dependencies

- `Audio` global (audio.js) — `Audio.play('land')`, `Audio.play('gem')`, `Audio.play('tap')`, `Audio.play('lose')`
- `AdManager` global (ads.js) — `gameplayStart()`, `gameplayStop()`, `onRunEnd()`, `showInterstitial()`, `offerDoubleScore()`
- `Input` global (input.js) — pointer events routed via `tap(x, y)` by main.js
- Canvas 2D API only — no image assets, no external libraries
