# Paint Fill — Codebase Reference

## Overview
Paint Fill is a flood-fill puzzle game where the player taps color buttons to flood-fill a 10×10 grid starting from the top-left corner. The goal is to fill the entire grid with one uniform color in 20 moves or fewer; each successfully cleared board increments the score.

## File: js/game.js
- **Lines:** ~543
- **Global namespace:** `PaintFill`
- **Canvas size:** 390×844 virtual px

## State Machine
- `'MENU'` — animated color-cell background, title, color swatches, "TAP TO PLAY"
- `'PLAYING'` — 10×10 grid + HUD + color buttons visible; tap starts from MENU
- `'DEAD'` — "OUT OF MOVES!" overlay drawn on top of the frozen grid; tap restarts

Transitions:
- MENU → PLAYING: any tap calls `startGame()`
- PLAYING → PLAYING: `nextBoard()` when `isGridComplete()` returns true (board cleared)
- PLAYING → DEAD: `gameOver()` when `movesLeft <= 0` and grid is not complete
- DEAD → PLAYING: any tap calls `startGame()` (resets score to 0)

## Core Variables
| Variable | Purpose |
|----------|---------|
| `state` | Current game state string: `'MENU'`, `'PLAYING'`, `'DEAD'` |
| `score` | Number of boards solved this run |
| `_best` | All-time best score (boards solved) |
| `t` | Global animation time in seconds |
| `movesLeft` | Moves remaining on the current board (starts at `MAX_MOVES = 20`) |
| `grid` | Flat `Array` of length 100 (10×10), each entry a color index 0–3 |
| `COLS` / `ROWS` | 10 / 10 |
| `MAX_MOVES` | 20 |
| `COLORS` | `['#E74C3C', '#3498DB', '#2ECC71', '#F39C12']` — 4 available colors |
| `CELL_SIZE` | Computed in `computeLayout()` as `Math.floor((390 - 40) / 10)` = 35 |
| `BTN_SIZE` | 64 px per color button |
| `BTN_GAP` | 16 px between buttons |
| `BTN_Y` | 764 (VH - 80); button center row |
| `GRID_TOP` | 130 px from canvas top |
| `GRID_MARGIN` | 20 px left/right margin |

## Key Functions
- `init(canvas, bestScore)` — stores canvas ref, calls `computeLayout()`, resets all state to MENU
- `startGame()` — sets `movesLeft = MAX_MOVES`, `score = 0`, calls `buildBoard()`, sets state to PLAYING, fires `AdManager.gameplayStart()`
- `nextBoard()` — increments `score`, resets `movesLeft`, calls `buildBoard()`, stays in PLAYING
- `gameOver()` — sets state to DEAD, plays 'lose' sound, fires `AdManager.gameplayStop()`, `AdManager.onRunEnd()`, `AdManager.showInterstitial()`, `AdManager.offerDoubleScore(score, 'paintfill_best')`
- `update(dt)` — clamps dt to 0.05s, increments `t`
- `draw()` — dispatches to `drawMenu()`, `drawPlaying()`, or `drawDead()` overlay
- `tap(vx, vy)` — handles state transitions and color-button hit testing
- `floodFill(newColorIdx)` — iterative stack-based BFS/DFS flood-fill from cell (0,0); no-ops if same color chosen
- `isGridComplete()` — checks all 100 cells equal `grid[0]`
- `buildBoard()` — fills `grid` with random indices 0–3, re-rolls if grid is already uniform
- `computeLayout()` — calculates `CELL_SIZE` and `BTN_Y`
- `drawGrid()` — renders 10×10 colored cells with 2 px border gaps; highlights cell (0,0) with white stroke
- `drawButtons()` — renders 4 color buttons centered at bottom; active (current origin color) gets glow, white border, and a checkmark
- `drawHUD()` — score (top center), best (top right), moves label and counter (top left), moves progress bar (green→orange→red)
- `roundRect(x, y, w, h, r)` — reusable rounded rectangle path helper

## Difficulty Scaling
There is no explicit difficulty ramp. The board is always a random 10×10 grid with 4 colors and a fixed 20-move limit. Implicit difficulty arises from randomness — some boards require more moves than others, but no parameter changes with score.

## localStorage Keys
- `'paintfill_best'` — passed as the second argument to `AdManager.offerDoubleScore()`; the actual read/write to localStorage is handled by the shared `AdManager` / harness layer, not directly in game.js

## Dependencies
- **Audio:** `snd('button')` on menu/dead tap, `snd('tap')` on valid color pick, `snd('gem')` on board clear, `snd('lose')` on game over
- **AdManager:** `gameplayStart()` at `startGame()`, `gameplayStop()` + `onRunEnd()` at `gameOver()`, `showInterstitial(() => {})` at `gameOver()`, `offerDoubleScore(score, 'paintfill_best')` at `gameOver()`
