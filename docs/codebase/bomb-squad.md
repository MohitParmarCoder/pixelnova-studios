# Bomb Squad — Codebase Reference

## Overview

Bomb Squad is a Minesweeper-style HTML5 canvas game implemented as a single JavaScript file with no build step or external dependencies beyond the shared game platform (audio, ads, input modules). The player reveals cells on an 8x10 grid while avoiding 12 hidden mines. A flag mode lets the player mark suspected mines. The first tap on each board is always safe. Clearing all safe cells wins the board and starts a new one with score preserved, enabling multi-board sessions.

## File Info

| Property | Value |
|---|---|
| Global name | `BombSquad` |
| Approximate line count | ~461 |
| Language | Vanilla JavaScript (ES5/ES6, no modules) |
| Entry point | `BombSquad` object exposed as a single global |
| Build step | None — served as static HTML + JS |

## State Machine

```
MENU → PLAYING → DEAD
         ↑         (game over, all mines revealed)
         └── (board win: winFlash 0.8s → initBoard(), score preserved)
```

| State | Description | Transitions |
|---|---|---|
| `MENU` | Title/start screen | Tap to start → `PLAYING` (calls `startGame()`) |
| `PLAYING` | Active minesweeper board | Mine hit with lives>0 → stay `PLAYING`; lives=0 → `DEAD`; all safe revealed → winBoard() → `PLAYING` |
| `DEAD` | Game over screen, all mines revealed | Tap to restart → `MENU` |

## Key Variables

| Name | Type / Default | Purpose |
|---|---|---|
| `score` | number / 0 | Cumulative score across boards in the session |
| `lives` | number / 3 | Remaining lives; game over when reaches 0 |
| `cells` | Array(80) | Flat array of cell objects for the 8x10 grid |
| `NUM_MINES` | constant / 12 | Number of mines placed per board |
| `CELL_W` | constant / 42 | Cell width in pixels |
| `CELL_H` | constant / 44 | Cell height in pixels |
| `GX` | constant / 27 | Grid origin X (left edge of grid) |
| `GY` | constant / 90 | Grid origin Y (top edge of grid) |
| `firstTap` | boolean / true | True until first cell is tapped; triggers safe mine placement |
| `flagMode` | boolean / false | When true, taps place/remove flags instead of revealing |
| `flagsPlaced` | number / 0 | Count of currently placed flags |
| `revealedCount` | number / 0 | Number of safe cells revealed so far |
| `numSafe` | constant / 68 | Total safe cells per board (COLS*ROWS - NUM_MINES = 80-12) |
| `elapsedTime` | number / 0 | Seconds elapsed since board start, used in win score bonus |
| `flashTimer` | number / 0 | Countdown timer driving win flash animation |
| `winFlash` | constant / 0.8 | Duration in seconds of the win flash effect |
| `lastTapTime` | number / 0 | Timestamp of last tap for 150ms debounce |

## Grid System

| Property | Value |
|---|---|
| Columns (`COLS`) | 8 |
| Rows (`ROWS`) | 10 |
| Total cells | 80 |
| Cell width (`CELL_W`) | 42 px |
| Cell height (`CELL_H`) | 44 px |
| Grid origin X (`GX`) | 27 px |
| Grid origin Y (`GY`) | 90 px |
| Mines per board (`NUM_MINES`) | 12 |
| Safe cells per board (`numSafe`) | 68 |

Cells are stored in a flat array; index = `row * COLS + col`.

## Cell Object Structure

```js
{
  mine: boolean,          // true if this cell contains a mine
  revealed: boolean,      // true if the cell has been uncovered
  flagged: boolean,       // true if the player has placed a flag here
  adjacentMines: number,  // count of mines in the 8 neighboring cells (0–8)
  exploded: boolean       // true if this specific mine was the one hit
}
```

## Key Functions

| Function | Description |
|---|---|
| `startGame()` | Transitions from MENU to PLAYING, resets score/lives, calls `gameplayStart()`, calls `initBoard()` |
| `initBoard()` | Resets cells array, sets `firstTap=true`, resets `revealedCount`, `flagsPlaced`, `elapsedTime` |
| `placeMines(avoidIdx)` | Places `NUM_MINES` mines randomly, skipping the cell at `avoidIdx` (first-tap safety) |
| `calcAdjacency()` | Fills `adjacentMines` for every non-mine cell after mine placement |
| `hitMine(cell)` | Decrements lives, marks cell as exploded; if lives<=0 triggers game over with `gameplayStop()`+`onRunEnd()`+`showInterstitial()` |
| `floodReveal(idx)` | Recursively reveals all connected cells with `adjacentMines===0` and their numbered border cells |
| `winBoard()` | Awards win bonus score, plays 'gem' sound, sets `flashTimer=winFlash`, then calls `initBoard()` after flash |
| `tap(x, y)` | Handles input: maps canvas coords to cell index, enforces 150ms debounce, delegates to flag or reveal logic |
| `draw()` | Renders the full frame: background, grid cells, HUD (score, lives, flag button), state overlays |
| `update(dt)` | Advances `elapsedTime` and `flashTimer` each frame |

## Scoring Formula

**Per reveal (dig mode only):** `score += 5`

**Per board cleared (win):**
```
score += numSafe * 3 + max(0, 300 - floor(elapsedTime * 2))
```
- `numSafe * 3` = 68 * 3 = 204 base points
- Time bonus: up to 300 points, reduced by 2 per elapsed second (reaches 0 at 150 seconds)
- Score is cumulative across boards in a single session

## First-Tap Safety Mechanic

`firstTap` is initialized to `true` when `initBoard()` runs. On the first `tap()` call, mines are placed via `placeMines(avoidIdx)` where `avoidIdx` is the index of the tapped cell, ensuring that cell cannot contain a mine. `firstTap` is then set to `false`. Subsequent taps use the pre-placed mine layout.

## localStorage Key

| Key | Content |
|---|---|
| `bombsquad_best` | Highest score achieved across all sessions |

## External Dependencies

| Dependency | Role |
|---|---|
| Audio module | Plays sounds: `'tap'`, `'crash'`, `'gem'`, `'lose'` |
| AdManager / ads module | `gameplayStart()`, `gameplayStop()`, `onRunEnd()`, `showInterstitial()`, `offerDoubleScore()` |
| Input module | Provides unified pointer/touch input coordinates |
| Shared canvas/game runner | Drives `update(dt)` and `draw()` via requestAnimationFrame loop |
