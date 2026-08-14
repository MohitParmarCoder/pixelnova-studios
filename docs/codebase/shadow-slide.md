# Shadow Slide — Codebase Reference
## Overview
Shadow Slide is a side-scrolling endless runner in which the player controls a glowing yellow orb that jumps between floating platforms inside a near-total darkness environment. A candle-light spotlight of radius 130 px follows the player and is the only region where platforms are visible, creating a tense "play by feel" dynamic.

## File: js/game.js
- Lines: ~650 (estimated)
- Global namespace: `ShadowSlide`
- Canvas size: 390×844 virtual px

## State Machine
```
MENU → PLAYING → DEAD
         ↑          |
         └──────────┘  (life remaining: respawn; 0 lives: stay DEAD)
```
- `MENU`: tap to start
- `PLAYING`: active gameplay
- `DEAD`: show score, offer double score / retry

## Core Variables
| Variable | Value | Purpose |
|---|---|---|
| `GRAVITY` | 1800 | Downward acceleration (px/s²) |
| `JUMP_VEL` | -700 | Vertical velocity on tap (px/s) |
| `PLAYER_R` | 12 | Player orb radius (px) |
| `PLAYER_X` | 100 | Fixed horizontal position of player |
| `SCROLL_SPEED` | 180 | Initial platform scroll speed (px/s) |
| `SPEED_INC` | 8 | Speed increase per platform landed |
| `MAX_SPEED` | 500 | Hard cap on scroll speed |
| `LIGHT_RADIUS` | 130 | Spotlight radius around player (px) |
| `lives` | 3 | Starting life count |
| `score` | 0 | Platforms uniquely landed on |

## Key Functions
- `init()` — Sets up canvas, audio, ad manager; registers input listeners; draws initial MENU screen.
- `_startGame()` — Resets score/lives, calls `_seedPlatforms()`, calls `AdManager.gameplayStart()`, sets state to PLAYING.
- `_die()` — Decrements lives; if lives > 0 respawns (resets platforms, places player on first platform); if lives === 0 transitions to DEAD, calls `AdManager.gameplayStop()` + `onRunEnd()`.
- `update(dt)` — Physics tick: moves player horizontally (no-op, X fixed), applies gravity, scrolls platforms, checks landing/death collisions, calls `_extendPlatforms()` + `_prunePlatforms()`. `dt` is clamped to 0.05 s.
- `tap()` — In MENU: calls `_startGame()`; in PLAYING: applies `JUMP_VEL` if player is on a platform; in DEAD: calls `AdManager.showInterstitial()` then `offerDoubleScore()`.
- `draw()` — Clears canvas, draws scrolling platforms, draws player orb with glow, calls `_drawDarknessOverlay()`.
- `_drawDarknessOverlay()` — Paints a full-canvas black rect on an offscreen canvas; punches out a circle at player position using `destination-out` compositing to reveal the spotlight; composites onto main canvas.
- `_seedPlatforms()` — Generates the initial set of platforms spread across the canvas so the player always has a safe starting position.
- `_extendPlatforms()` — Appends new platforms (width 70–160 px, gap 90–200 px) when the rightmost platform scrolls within range.
- `_prunePlatforms()` — Removes platforms whose right edge has scrolled past x=0 to free memory.

## Difficulty Scaling
Scroll speed increases by `SPEED_INC` (8 px/s) for every platform the player successfully lands on, capped at `MAX_SPEED` (500 px/s). Platform width and gap ranges stay constant, but faster speed makes the timing window shorter, effectively scaling difficulty continuously.

## localStorage Keys
| Key | Content |
|---|---|
| `shadowslide_best` | All-time high score (integer) |

## Dependencies
### Audio (sounds used)
| Sound | Trigger |
|---|---|
| `tap` | Every jump tap |
| `gem` | Platform landed (score increments) |
| `crash` | Player misses platform and loses a life |
| `lose` | Final life lost — game over |

### AdManager Calls
| Call | Location |
|---|---|
| `AdManager.gameplayStart()` | `_startGame()` |
| `AdManager.gameplayStop()` | `_die()` when lives reach 0 |
| `AdManager.onRunEnd()` | `_die()` when lives reach 0 |
| `AdManager.showInterstitial()` | `tap()` in DEAD state |
| `AdManager.offerDoubleScore(score, 'shadowslide_best')` | `tap()` in DEAD state |
