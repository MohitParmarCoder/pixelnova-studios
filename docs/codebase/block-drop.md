# Block Drop — Codebase Reference

## Overview

Block Drop is a Tetris-lite HTML5 canvas game implemented as a single vanilla JavaScript file with no build step or external dependencies beyond the shared Audio, AdManager, and Input modules. Pieces of various sizes fall into a 7-column grid and the player clears rows to score points. Difficulty increases automatically as rows are cleared, tightening the fall interval until pieces drop at maximum speed.

## File Info

| Property | Value |
|---|---|
| Global name | `BlockDrop` |
| Approximate line count | ~712 |
| Language | Vanilla JavaScript (ES5/ES6, IIFE pattern) |
| Entry point | Loaded via `<script>` tag; no bundler |

## State Machine

```
MENU → PLAYING → DEAD
```

| State | Description | Transitions |
|---|---|---|
| `MENU` | Title screen with start prompt | Tap anywhere → `PLAYING` (calls `startGame()`) |
| `PLAYING` | Active gameplay; pieces fall, player taps to control | Spawn collision → `DEAD` (calls `endGame()`) |
| `DEAD` | Game-over screen; shows final score and double-score offer | Tap → `MENU` |

## Key Variables

| Name | Type / Default | Purpose |
|---|---|---|
| `score` | number / 0 | Current run score |
| `best` | number / localStorage | All-time high score |
| `level` | number / 1 | Current difficulty level; drives fall speed |
| `rowsCleared` | number / 0 | Cumulative rows cleared this run |
| `grid` | `Array[14][7]` of color or null | Game board state; null = empty cell |
| `piece` | object / null | Active falling piece: `{shapeIdx, col, rowF, color}` |
| `fallTimer` | number | Seconds elapsed since last downward step |
| `fallInterval` | number / `fallSpeed()` | Seconds per one-cell drop; recomputed on each clear |
| `dropFast` | boolean / false | True during an instant-drop sequence |
| `stars` | Array[80] | Background star positions and sizes |
| `flashTimer` | number | Counts down 0.18 s during row-clear flash animation |
| `flashRows` | Array | Row indices currently flashing white |
| `COLS` | const / 7 | Grid column count |
| `CELL` | const / 50 | Cell size in virtual canvas pixels |
| `GRID_ROWS` | const / 14 | Grid row count |
| `GRID_X` | const / 20 | `floor((VW - COLS*CELL) / 2)` — left edge of grid |
| `GRID_Y` | const / 120 | Top edge of grid in virtual canvas pixels |

## Grid and Shape System

**Grid:** 14 rows x 7 columns (`GRID_ROWS x COLS`). Each cell holds a color string or `null`. The grid origin in canvas space is `(GRID_X=20, GRID_Y=120)` with each cell drawn at `CELL=50` pixels.

**Piece representation:** `{ shapeIdx, col, rowF, color }` where `rowF` is the floating-point row position used for sub-cell fall physics.

**Shape types (5):**

| Index | Dimensions | Description |
|---|---|---|
| 0 | 1x1 | Single cell |
| 1 | 1x2 | Vertical domino |
| 2 | 1x3 | Vertical tromino |
| 3 | 2x1 | Horizontal domino |
| 4 | 2x2 | Square tetromino |

**Colors (5):** `red`, `blue`, `green`, `yellow`, `magenta`. Assigned randomly at spawn.

## Key Functions

| Function | Description |
|---|---|
| `init()` | Sets up canvas, loads best score, spawns stars, starts the rAF loop |
| `startGame()` | Resets state, calls `gameplayStart()`, spawns first piece |
| `endGame()` | Sets state to `DEAD`, calls `gameplayStop()`, `onRunEnd()`, `showInterstitial()`, and `offerDoubleScore()` |
| `spawnPiece()` | Picks random shape and color, places at top center; collision at spawn triggers `endGame()` |
| `update(dt)` | Main update dispatcher; routes to `updateMenu`, `updatePlaying`, or `updateDead` |
| `updatePlaying(dt)` | Advances `fallTimer`, moves piece down, checks landing |
| `land()` | Writes piece cells into `grid`, checks for completed rows, triggers flash |
| `clearRows()` | Identifies full rows, sets `flashRows`, increments `rowsCleared`, updates `score` and `level` |
| `finishClear()` | Called after flash timer expires; removes completed rows, shifts grid down |
| `dropInstant()` | Teleports piece to lowest valid position, sets `dropFast=true`, plays `'crash'` sound |
| `ghostRow()` | Returns the row index where the current piece would land; used for ghost preview rendering |
| `fallSpeed()` | Returns `max(0.15, 0.8 - floor(rowsCleared/5) * 0.05)` |
| `handleTap(x, y)` | Dispatches tap events: left zone moves piece left, center instant-drops, right zone moves right |
| `draw()` | Renders stars, grid, ghost, active piece, HUD panel, and any overlay screens |
| `drawHUD()` | Draws right-side panel with score, best, and level |

## Difficulty Scaling

```
fallSpeed() = max(0.15, 0.8 - floor(rowsCleared / 5) * 0.05)
```

- Level 1 (0–4 rows cleared): 0.80 s/cell
- Each 5 rows cleared reduces the interval by 0.05 s and increments `level` by 1
- Hard floor of 0.15 s/cell; speed and level stop increasing beyond that point
- `level = floor(rowsCleared / 5) + 1`

## localStorage

| Key | Content |
|---|---|
| `blockdrop_best` | Highest score achieved; integer |

## External Dependencies

| Module | Usage |
|---|---|
| `Audio` | Plays `'tap'` (move), `'gem'` (land), `'crash'` (instant drop), `'lose'` (game over) |
| `AdManager` | `gameplayStart()`, `gameplayStop()`, `onRunEnd()`, `showInterstitial()`, `offerDoubleScore()` |
| `Input` | Provides `consumePress()` / tap coordinates for zone-based control dispatch |
