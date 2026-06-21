# Arrow Dodge — Codebase Reference

## Overview
Arrow Dodge is a single-file HTML5 canvas arcade game where the player taps to fire arrows at falling bullseye targets while contending with increasing wind. The global namespace is `ArrowDodge` and the entire game logic is contained in `js/game.js` at approximately 399 lines.

## File: js/game.js
- **Lines:** ~399
- **Global namespace:** `ArrowDodge`
- **Canvas size:** 390×844 virtual px

## State Machine

```
MENU → PLAYING → DEAD
```

- `MENU` — title screen, shows best score, tap to start.
- `PLAYING` — active gameplay; player fires arrows, targets fall.
- `DEAD` — game over screen; shows score, triggers ad flow, offers double score.

## Core Variables

| Variable | Description |
|---|---|
| `score` | Current run score |
| `lives` | Remaining lives, starts at 3 |
| `wind` | Horizontal force applied to arrows each frame (`vx += wind*dt*0.4`) |
| `cooldown` | Fire cooldown timer; max value `COOLDOWN_MAX = 0.5s` |
| `targets` | Array of 3 colored bullseye targets; move horizontally and fall |
| `playerArrows` | Array of in-flight arrow objects |
| `archerX / archerY` | Fixed archer position at `VW/2, 760` |
| `flashTimer` | Timer driving screen flash on life loss |
| `stars` | Array of 60 background star objects for parallax decoration |

## Key Functions

- `init(canvas, bestScore)` — Sets canvas reference, seeds stars array, resets state to `MENU`.
- `startGame()` — Resets `score`, `lives`, `wind`, `cooldown`, spawns initial `targets`; calls `AdManager.gameplayStart()`.
- `update(dt)` — Main update loop: advances arrows with wind physics, moves and drops targets, checks collisions, decrements cooldown.
- `draw()` — Clears canvas, draws stars, archer, targets (bullseye rings), in-flight arrows, HUD (score, lives, wind indicator).
- `fireArrow(tapX, tapY)` — Spawns an arrow object aimed at `(tapX, tapY)` from `(archerX, archerY)` at speed 600 px/s; plays `'tap'` sound; respects `cooldown`.
- `loseLife()` — Decrements `lives`, plays `'crash'`, triggers `showInterstitial`; if `lives <= 0` transitions to `DEAD`, calls `gameplayStop()`, `onRunEnd()`, `offerDoubleScore()`.
- `onArrowHit(arrow, target)` — Removes arrow and target, plays `'gem'`, computes `pts = max(5, floor(distToArcher/30))`, increments `score`, spawns replacement target.
- `scaleDifficulty()` — Called when `score` crosses each 30-point threshold; re-rolls wind and updates target fall speeds.

## Difficulty Scaling

Every 30 score points:
- **Wind:** re-rolled as `(random - 0.5) * (40 + floor(score/30) * 15)` — magnitude grows by 15 units per tier.
- **Target fall speed:** `28 + random*18 + floor(score/30)*4` px/s — base grows by 4 px/s per tier.

## localStorage Keys

| Key | Content |
|---|---|
| `arrowdodge_best` | Highest score achieved |

## Dependencies

**Audio sounds (via `Audio` module):**
- `'tap'` — played on arrow fire
- `'crash'` — played on life loss
- `'gem'` — played on target hit
- `'lose'` — played on game over

**AdManager calls:**
- `gameplayStart()` — called in `startGame()`
- `gameplayStop()` — called in `loseLife()` when `lives <= 0`
- `onRunEnd()` — called in `loseLife()` when `lives <= 0`
- `showInterstitial()` — called in `loseLife()`
- `offerDoubleScore(score, 'arrowdodge_best')` — called on game over
