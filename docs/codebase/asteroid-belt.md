# Asteroid Belt — Codebase Reference

## Overview
Asteroid Belt is a drag-to-dodge HTML5 canvas survival game where the player pilots a spaceship by dragging, collecting crystals for points while avoiding asteroids that spawn from all four screen edges. The global namespace is `AsteroidBelt` and all game logic is contained in `js/game.js` at approximately 329 lines.

## File: js/game.js
- **Lines:** ~329
- **Global namespace:** `AsteroidBelt`
- **Canvas size:** 390×844 virtual px

## State Machine

```
MENU → PLAYING → DEAD
```

- `MENU` — title screen, shows best score, tap/drag to start.
- `PLAYING` — active gameplay; player steers ship, asteroids spawn, crystals appear.
- `DEAD` — game over; shows final score, triggers ad flow and double-score offer.

## Core Variables

| Variable | Description |
|---|---|
| `score` | Crystal collection count for current run |
| `lives` | Remaining lives, starts at 3 |
| `playerX / playerY` | Current ship position (smoothly interpolated) |
| `playerTargetX / playerTargetY` | Raw tap/drag destination; ship lerps toward this |
| `asteroids` | Array of active asteroid objects |
| `crystals` | Array of active crystal objects (up to 5 simultaneous) |
| `spawnTimer` | Countdown to next asteroid spawn |
| `crystalTimer` | Countdown to next crystal spawn (fires every 2.2s) |
| `tick` | Elapsed game time in seconds; drives difficulty scaling |
| `flashTimer` | Timer for screen flash on life loss |
| `stars` | Array of 100 background star objects |

## Key Functions

- `init(canvas, bestScore)` — Sets canvas reference, seeds `stars` array (100 objects), resets state to `MENU`.
- `startGame()` — Resets `score`, `lives`, `tick`, `spawnTimer`, `crystalTimer`, clears `asteroids` and `crystals`; calls `AdManager.gameplayStart()`.
- `update(dt)` — Main update: increments `tick`, smooths player position (`dx * min(1, dt*7)`), moves asteroids toward center, moves crystals, checks collisions, counts down spawn timers.
- `draw()` — Clears canvas, draws stars, ship, asteroids, crystals, HUD (score, lives).
- `spawnAsteroid()` — Selects one of 4 edges at random, spawns asteroid aimed at canvas center with speed `80 + random*80 + tick*0.04`.
- `spawnCrystal()` — Places a crystal at a random position away from the player; caps at 5 active crystals.
- `checkCollisions()` — Tests player vs. each asteroid (radius-based) → `loseLife()`; tests player vs. each crystal within `r=14px` → `score++`, plays `'gem'`.
- `loseLife()` — Decrements `lives`, plays `'crash'`, triggers `showInterstitial`; if `lives <= 0` transitions to `DEAD`, calls `gameplayStop()`, `onRunEnd()`, `offerDoubleScore()`.

## Difficulty Scaling

Scaling is continuous with `tick` (elapsed seconds):

- **Asteroid spawn interval:** `max(0.5, 1.6 - tick * 0.025)` seconds — starts at 1.6s, reaches minimum 0.5s after ~44 seconds of play.
- **Asteroid speed:** `80 + random*80 + tick*0.04` px/s — grows linearly with `tick`.

No discrete tier thresholds; difficulty ramps smoothly from the start of each run.

## localStorage Keys

| Key | Content |
|---|---|
| `asteroidbelt_best` | Highest score (crystal count) achieved |

## Dependencies

**Audio sounds (via `Audio` module):**
- `'gem'` — played on crystal collection
- `'crash'` — played on asteroid collision / life loss

**AdManager calls:**
- `gameplayStart()` — called in `startGame()`
- `gameplayStop()` — called when `lives <= 0`
- `onRunEnd()` — called when `lives <= 0`
- `showInterstitial()` — called in `loseLife()`
- `offerDoubleScore(score, 'asteroidbelt_best')` — called on DEAD entry
