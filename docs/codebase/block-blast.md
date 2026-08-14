# Block Blast — Codebase Reference

## Overview
Block Blast is a single-file HTML5 canvas SameGame-variant where the player taps connected groups of same-colored blocks to blast them away before rising rows fill the grid. New rows push up from the bottom every 5 seconds, creating constant time pressure.

## File: js/game.js
- **Lines:** ~394
- **Global namespace:** `BlockBlast`
- **Canvas size:** 390×844 virtual px

## State Machine

```
MENU → PLAYING → DEAD
DEAD → MENU  (on tap, sets state='MENU')
```

- `MENU`: Title screen; tap to start.
- `PLAYING`: Active gameplay — tapping blasts groups, rows rise on timer.
- `DEAD`: Game over overlay; any tap returns to `MENU`.

## Core Variables

| Variable | Description |
|---|---|
| `score` | Cumulative cells blasted this run |
| `best` | All-time best score (mirrored from `localStorage`) |
| `COLS` | Grid column count: 7 |
| `ROWS` | Grid row count: 9 |
| `CELL` | Cell size: `floor(VW / (COLS + 1))` px |
| `GRID_X` | Grid left offset: `floor((VW - COLS*CELL) / 2)` |
| `GRID_Y` | Grid top offset: `floor(VH * 0.18)` |
| `COLORS` | Array of 7 distinct fill colors used for blocks |
| `grid` | 2D array `[ROWS][COLS]`; `-1` = empty cell, otherwise color index |
| `blastParticles` | Array of active particle objects (8 spawned per blasted cell) |
| `newRowTimer` | Countdown to next rising row (seconds); resets to `NEW_ROW_INTERVAL` |
| `NEW_ROW_INTERVAL` | Time between rising rows: 5 s |
| `shakeTime` | Countdown for screen-shake effect duration |
| `shakeAmt` | Current screen-shake pixel displacement |

## Key Functions

- **`startGame()`** — Resets score, fills initial grid with random colors, resets `newRowTimer`, calls `gameplayStart()`.
- **`tap(col, row)`** — Converts screen tap to grid cell, calls `floodFill(col, row)` to collect connected same-color group; if `group.length >= 2`, removes cells, adds `score += cells.length`, spawns particles, applies gravity.
- **`floodFill(col, row)`** — Iterative flood-fill collecting all orthogonally connected cells sharing the tapped cell's color index.
- **`applyGravity()`** — Drops all blocks downward within each column to fill gaps left by blasts.
- **`addNewRow()`** — Shifts entire grid up by one row (`grid[0]` discarded), fills `grid[ROWS-1]` with random colors. If any cell in row 0 is occupied after shift, calls `killPlayer()`.
- **`killPlayer()`** — Transitions to `DEAD`, calls `gameplayStop()` + `onRunEnd()` + `showInterstitial()`, triggers `offerDoubleScore`.
- **`update(dt)`** — Decrements `newRowTimer`; when elapsed calls `addNewRow()` and resets timer. Updates particles and shake.
- **`draw()`** — Renders grid cells, blast particles, HUD (score top-center, timer bar below grid showing progress until next row), game-over overlay.

## Difficulty Scaling

No explicit speed scaling — `NEW_ROW_INTERVAL` stays at 5 s throughout. Difficulty increases implicitly as the grid fills and viable blast groups shrink. Score scales naturally: larger groups yield more points per tap (`score += cells.length`).

## localStorage Keys

| Key | Content |
|---|---|
| `blockblast_best` | All-time high score (integer) |

## Dependencies

- **Audio:** `Audio.play('gem')` on successful blast; `Audio.play('lose')` on death; `Audio.play('tap')` on any tap (including single-cell taps that do not blast).
- **Ads:** `gameplayStart()` in `startGame()`; `gameplayStop()` + `onRunEnd()` + `showInterstitial()` in `killPlayer()`; `offerDoubleScore(score, 'blockblast_best')` on game over.
