# Zombie Smash — Codebase Reference

## Overview
Zombie Smash is a tap-defense arcade game. Zombies march from both sides toward the center line. The player must tap each zombie to smash it before it reaches center. The global namespace is `ZombieSmash` and the entire game logic is contained in `js/game.js`.

## File: js/game.js
- **Global namespace:** `ZombieSmash`
- **Canvas size:** 390×844 virtual px

## State Machine
```
MENU → PLAYING → DEAD
```

## Core Variables

| Variable | Description |
|---|---|
| `score` | Zombies smashed |
| `lives` | Remaining lives (starts at MAX_LIVES = 5) |
| `zombies` | Array of zombie objects: `{x, y, speed, dir, r, smashed}` |
| `spawnTimer` | Countdown until next zombie spawn |
| `spawnInterval` | Starts at 2.0s; decreases with score via `diffTimer` |
| `particles` | Particle array for smash effects |
| `CENTER_LINE` | `VW/2` = 195 — zombies reaching this lose a life |
| `ZOMBIE_R` | 24px zombie radius |

## Key Functions
- `init(canvas, bestScore)` — Sets canvas, initializes empty arrays.
- `startGame()` — Resets all, calls `gameplayStart()`.
- `spawnZombie()` — Creates zombie from left or right edge; speed = `40 + random*30 + min(score*1.5, 90)`.
- `update(dt)` — Moves zombies; checks if any reached center (lose life); manages spawn timer; difficulty ramp via `diffTimer`.
- `tap(x, y)` — Checks tap against all zombie positions; hit if within `r*1.6` (generous hitbox); marks smashed, adds particles, increments score.
- `draw()` — Draws ground, center line, zombies with eye/wobble animations, particles, HUD.

## PR #22 Fix — Multi-Life Drain
Fixed: multiple zombies could reach center on same frame, each taking a life. Now capped:
```js
var livesLostThisFrame = 0;
// in update loop:
if (zombie reaches center && livesLostThisFrame < 1) {
  lives--; livesLostThisFrame++;
}
```

## Difficulty Scaling
Every 5s (`diffTimer` decrements), `spawnInterval` decreases by 0.1s (floor: 0.5s). Zombie speed formula includes `score*1.5` capped at 90.

## localStorage Keys
| Key | Content |
|---|---|
| `zombiesmash_best` | Highest score achieved |

## Ad Integration Points
| Event | AdManager Call |
|---|---|
| Game start | `AdManager.gameplayStart()` |
| Game over | `AdManager.gameplayStop()` + `onRunEnd()` |
| Between runs | `AdManager.showInterstitial()` |
| DEAD screen | `AdManager.offerDoubleScore(score, 'zombiesmash_best')` |
