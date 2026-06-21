# Mirror Tap — Codebase Reference

## Overview
Mirror Tap is a memory and spatial-reasoning game where the left half of the screen shows a pattern of highlighted dots, and the player must tap the mirrored positions on the right half from memory. Each successful round increases the pattern size and advances to the next round.

## File: js/game.js
- **Lines:** ~143
- **Global namespace:** `MirrorTap`
- **Canvas size:** 390×844 virtual px

## State Machine
- `'MENU'` — title screen showing title, instructions, and best score; tap starts game
- `'PLAYING'` — active gameplay; cycles through two sub-phases:
  - `phase = 'SHOW'` — pattern is visible on the left side; `showTimer` counts down
  - `phase = 'TAP'` — left pattern hidden; player taps mirror positions on the right
- `'DEAD'` — game over overlay; tap restarts

Transitions:
- `MENU` → tap → `PLAYING` (via `startGame()`)
- `PLAYING/SHOW` → `showTimer <= 0` → `PLAYING/TAP`
- `PLAYING/TAP` → all correct taps made → `score++` → setTimeout 500 ms → new round (`newRound()`)
- `PLAYING/TAP` → wrong tap → `lives--`; if `lives <= 0` → `DEAD`
- `DEAD` → tap → `PLAYING` (via `startGame()`)

## Core Variables
| Variable | Purpose |
|----------|---------|
| `score` | Number of rounds successfully completed (also used as display score) |
| `lives` | Remaining lives, starts at 3 |
| `round` | Round counter (0-indexed); drives pattern size and `showTimer` |
| `best` | Best score (rounds cleared); persisted externally, passed via `init` |
| `leftPattern` | Array of dot indices that are active (highlighted) on the left side |
| `rightTaps` | Array of dot indices the player has tapped on the right side |
| `phase` | `'SHOW'` or `'TAP'` — sub-phase of the PLAYING state |
| `showTimer` | Countdown for the SHOW phase: `1.5 + n * 0.2` seconds (n = pattern size) |
| `dotPositions[]` | Array of `{x, y}` positions for the 8 dots (`DOTS = 8`) on the left half |
| `DOTS` | Constant `8` — total dot count per side |

## Key Functions
- `init(canvas, bestScore)` — stores canvas/ctx, seeds `best`, sets `state = 'MENU'`
- `startGame()` — zeroes `score`/`lives`/`round`, sets `state = 'PLAYING'`, calls `AdManager.gameplayStart()`, calls `newRound()`
- `newRound()` — calls `makeDotPositions()`, computes pattern size `n = min(3 + floor(round/2), DOTS)`, builds shuffled `leftPattern`, resets `rightTaps`, starts `phase = 'SHOW'`
- `makeDotPositions()` — generates 8 random `{x, y}` positions in the left half (x: 40–VW/2–40, y: 250–VH–170)
- `getMirrorX(x)` — returns `VW - x`; maps left-side dot x to its mirrored right-side x
- `update(dt)` — dt clamped to 0.05 s; in SHOW phase ticks `showTimer` down; transitions to TAP phase when timer expires
- `tap(x, y)` — state router; in PLAYING/TAP: rejects left-side taps (`x < VW/2`); mirrors tap x via `getMirrorX()`; hit-tests all dots (radius 22 px); correct tap → `rightTaps.push(i)`, wrong tap → `lives--`; completion check → `score++` + `newRound()` after 500 ms
- `draw()` — renders background, vertical centre line, dot grid (both sides), HUD (score, hearts, phase prompt), and DEAD overlay
- `getBest()` — public accessor

## Difficulty Scaling
- Pattern size starts at 3 dots (`n = min(3 + floor(round/2), DOTS)`)
- Round 0: 3 dots; Round 2: 4 dots; Round 4: 5 dots; ... caps at 8 dots (all active)
- Show timer grows with pattern size: `showTimer = 1.5 + n * 0.2` s (3 dots = 2.1 s, 8 dots = 3.1 s)
- Dot positions are re-randomised each round — no memorisation of dot layout carries over

## localStorage Keys
Mirror Tap does not write localStorage directly. Best score is passed in via `init(canvas, bestScore)`. The host uses `'mirrortap_best'` (referenced in `AdManager.offerDoubleScore` call as `'mirrortap_best'`).

## Dependencies
- `Audio.play('tap')` — correct dot tapped
- `Audio.play('gem')` — round completed successfully
- `Audio.play('crash')` — wrong tap (life lost)
- `AdManager.gameplayStart()` — called in `startGame()`
- `AdManager.gameplayStop()` — called on death (inside `tap()` when `lives <= 0`)
- `AdManager.onRunEnd()` — called on death (inside `tap()`)
- `AdManager.showInterstitial(() => {})` — called on death with empty callback (note: called without try/catch unlike other games)
- `AdManager.offerDoubleScore(score, 'mirrortap_best')` — called on death
