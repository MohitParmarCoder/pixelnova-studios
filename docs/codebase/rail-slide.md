# Rail Slide — Codebase Reference

## Overview
Rail Slide is a neon-styled infinite lane-switching runner where a skater on a hoverboard slides down three glowing rails. The player taps the left or right half of the screen to dodge incoming barrier obstacles and collect coins, surviving as long as possible while speed steadily increases.

## File: js/game.js
- **Lines:** ~866
- **Global namespace:** `RailSlide`
- **Canvas size:** 390×844 virtual px

## State Machine
- `MENU` → `PLAYING` (any tap)
- `PLAYING` → `DEAD` (obstacle collision via `killPlayer()`)
- `DEAD` → `PLAYING` (any tap, restarts via `startGame()`)

## Core Variables
| Variable | Type | Purpose |
|----------|------|---------|
| `state` | string | `'MENU'` \| `'PLAYING'` \| `'DEAD'` |
| `score` | number | Current score (distance pts + coin pts) |
| `best` | number | All-time best score |
| `distScore` | number | Fractional distance accumulator |
| `speed` | number | Current scroll speed in px/s |
| `lane` | number | Current lane index: 0=left, 1=center, 2=right |
| `laneAnim` | object\|null | `{from, to, t}` lane-switch tween state |
| `obstacles` | array | `[{lane, y}]` active barrier objects |
| `coins` | array | `[{lane, y, taken}]` active coin objects |
| `obTimer` | number | Seconds until next obstacle spawn |
| `coinTimer` | number | Seconds until next coin spawn |
| `time` | number | Total elapsed seconds in current run |
| `particles` | array | `[{x,y,vx,vy,life,maxLife,r,col}]` |
| `menuT` | number | Menu animation timer |
| `bobT` | number | Player bob animation accumulator |
| `_isNewBest` | boolean | Whether current run beat the best score |

## Key Constants
| Constant | Value | Meaning |
|----------|-------|---------|
| `LANE_POSITIONS` | `[97, 195, 293]` | x-centres for left, center, right lanes |
| `PLAYER_Y` | `260` | Fixed player y position (top third) |
| `BASE_SPEED` | `320` px/s | Starting scroll speed |
| `MAX_SPEED` | `780` px/s | Speed cap |
| `ACCEL` | `18` px/s² | Constant acceleration |
| `OBSTACLE_SPAWN_BASE` | `1.35` s | Initial seconds between obstacle spawns |
| `OBSTACLE_SPAWN_MIN` | `0.42` s | Minimum obstacle spawn interval |
| `COIN_SPAWN_BASE` | `0.85` s | Initial seconds between coin spawns |
| `COIN_SPAWN_MIN` | `0.32` s | Minimum coin spawn interval |
| `COIN_PTS` | `10` | Points per collected coin |
| `LANE_ANIM_DUR` | `0.07` s | Duration of lane-switch tween |

## Key Functions
- `init(c, bestScore)` — attaches canvas, sets `state = 'MENU'`
- `startGame()` — resets all state, sets `state = 'PLAYING'`, calls `AdManager.gameplayStart()`
- `update(dt)` — dt capped at 0.05 s; advances speed, timers, spawns, moves obstacles/coins, runs collision detection and coin pickup, culls off-screen objects, updates particles
- `draw()` — clears canvas, draws background gradient, perspective grid, rails, then dispatches to state-specific draw functions
- `tap(x, y)` — MENU/DEAD: `startGame()`; PLAYING: `x < VW/2` → `moveLeft()`, else → `moveRight()`
- `killPlayer()` — sets `state = 'DEAD'`, spawns crash particles, plays `crash` + `lose`, updates best, calls ad sequence
- `moveLeft()` / `moveRight()` — calls `startLaneAnim()`, plays `tap` sound
- `startLaneAnim(from, to)` — sets `laneAnim` object; snaps to destination if already animating
- `playerX()` — returns interpolated x using ease-out cubic during `laneAnim`
- `spawnObstacle()` — random lane, pushes to `obstacles` array below screen bottom
- `spawnCoin()` — random lane, spawns cluster of 1–4 coins staggered vertically
- `spawnCoinParticles(x, y)` — 8 radial particles in `COL_COIN` yellow
- `spawnCrashParticles(x, y)` — 18 radial particles in red/orange
- `filterAbove(arr, threshold)` — removes objects with `y <= threshold` (off top of screen)
- `drawGrid()` — perspective horizontal grid lines converging to vanishing point at `(VW/2, VH*0.15)`
- `drawRails()` — 3 glowing rails (cyan/white/magenta) with dashed dividers
- `drawPlayer()` — skater character: board, wheels, torso, head, visor, arms; uses `bobT` sine wave
- `drawHUD()` — score centered at top, speed bar below score, best score top-right
- `drawMenu()` — title, instructions, pulsing TAP TO PLAY, animated `drawMenuSkater()`
- `drawDeadOverlay()` — dimmed overlay with panel, WIPEOUT! header, score, best/new-best, TAP TO RETRY
- `roundRect(context, x, y, w, h, r)` — utility for rounded rectangles via quadratic curves
- `getBest()` — returns `best`

## Difficulty Scaling
Speed increases at `ACCEL = 18 px/s²` continuously from `BASE_SPEED = 320` up to `MAX_SPEED = 780`. Obstacle spawn interval shrinks linearly: `OBSTACLE_SPAWN_BASE - time * 0.012` clamped to `OBSTACLE_SPAWN_MIN = 0.42` s. Coin spawn interval shrinks similarly: `COIN_SPAWN_BASE - time * 0.008` clamped to `COIN_SPAWN_MIN = 0.32` s. Both intervals have ±20–30% random jitter.

## localStorage Keys
| Key | Content |
|-----|---------|
| `railslide_best` | Highest score (written via `AdManager.offerDoubleScore`) |

## Dependencies
- `Audio.play('gem')` — coin pickup sound
- `Audio.play('crash')` — player collision sound
- `Audio.play('lose')` — death fanfare
- `Audio.play('tap')` — lane switch click
- `AdManager.gameplayStart()` — called in `startGame()`
- `AdManager.gameplayStop()` — called in `killPlayer()`
- `AdManager.onRunEnd()` — called in `killPlayer()`
- `AdManager.showInterstitial(() => {})` — called in `killPlayer()`
- `AdManager.offerDoubleScore(score, 'railslide_best')` — called in `killPlayer()`
