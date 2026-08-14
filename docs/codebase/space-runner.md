# Space Runner — Codebase Reference

## Overview
Space Runner is a vanilla JS + Canvas2D shoot-em-up arcade game. The player controls a ship at the bottom of the screen, auto-fires bullets upward, and must destroy waves of aliens before they descend to the bottom or shoot the player 3 times. No build step; no npm dependencies.

## File: js/game.js
Single file containing the entire game: state machine, physics, rendering, input, audio hooks, and ad integration. Exposes the `SpaceRunner` global with public API methods `SpaceRunner.getState()` and `SpaceRunner.getScore()`.

## State Machine
```
MENU → PLAYING → DEAD
```
- **MENU**: Title screen; tap anywhere to call `startGame()`.
- **PLAYING**: Main gameplay loop — alien grid, player bullets, alien bullets, particle effects.
- **DEAD**: Game-over screen showing final score and best score; tap to return to MENU.

## Core Variables
| Variable | Type | Description |
|---|---|---|
| `state` | string | Current state: `'MENU'`, `'PLAYING'`, `'DEAD'` |
| `score` | number | Current score (0 at game start) |
| `lives` | number | Player lives (starts at 3) |
| `wave` | number | Current wave number (starts at 1) |
| `aliens` | array | Array of alien objects `{x, y, alive}` |
| `bullets` | array | Player bullet objects `{x, y}` |
| `alienBullets` | array | Alien bullet objects `{x, y}` |
| `particles` | array | Active particle objects |
| `stars` | array | 20 static background star positions |
| `alienSpeed` | number | Current alien horizontal speed (px/s) |
| `alienDir` | number | Alien movement direction: +1 or -1 |
| `shootTimer` | number | Countdown to next player auto-shoot |
| `alienShootTimer` | number | Countdown to next alien shot |
| `best` | number | Best score loaded from localStorage |

## Key Functions
| Function | Purpose |
|---|---|
| `init()` | Bootstraps canvas, stars, event listeners, starts rAF loop |
| `startGame()` | Resets all state, sets state to `'PLAYING'`, calls `AdManager.gameplayStart()` |
| `spawnWave()` | Creates ALIEN_COLS×ALIEN_ROWS (5×3=15) alien objects in grid formation |
| `update(dt)` | Main update dispatcher — routes to `updateMenu`, `updatePlaying`, or `updateDead` |
| `updatePlaying(dt)` | Moves aliens, fires bullets, checks collisions, spawns particles, checks win/loss |
| `draw()` | Main draw dispatcher — clears canvas, draws stars, routes to state draw function |
| `drawPlaying()` | Draws ship, aliens, bullets, alien bullets, particles, HUD (score, lives, wave) |
| `spawnParticles(x, y)` | Creates 8 particles at position with random velocity and lifespan |
| `checkCollisions()` | AABB/circle checks: player bullets vs aliens, alien bullets vs player |
| `endGame()` | Sets state to `'DEAD'`, saves best score, calls ad hooks |
| `onTap(x, y)` | Handles input: in PLAYING clamps ship.x to tap x (30 to VW-30); in MENU/DEAD starts/restarts |

## Difficulty Scaling
| Parameter | Formula | Min | Max |
|---|---|---|---|
| `alienSpeed` | `80 * Math.pow(1.1, wave-1)` | 80 px/s (wave 1) | 400 px/s (capped) |
| `alienShootInterval` | Decreases per wave from 1.8 s | 0.6 s | 1.8 s |
| `shootInterval` (player) | Fixed per session: starts 0.8 s | 0.3 s | 0.8 s |
| Score per alien | `10 * wave` | 10 (wave 1) | — |

Wave increments when all 15 aliens are destroyed.

## localStorage Keys
| Key | Value |
|---|---|
| `spacerunner_best` | Highest score ever achieved (integer string) |

## Dependencies
- `Audio` global (audio.js) — sounds: `'crash'`, `'lose'`, `'gem'`, `'tap'`
- `AdManager` global (ads.js) — hooks: `gameplayStart()`, `gameplayStop()`, `onRunEnd()`, `showInterstitial()`, `offerDoubleScore()`
- `Input` global (input.js) — unified pointer/keyboard input
- No external libraries; no build step
