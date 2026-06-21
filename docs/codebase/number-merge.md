# Number Merge — Codebase Reference

## Overview
Number Merge is a 2048-style sliding tile puzzle played on a 4×4 grid. Players swipe in four directions to slide and merge matching numbered tiles; the goal is to combine tiles until a 2048 tile is created.

## File: js/game.js
- **Lines:** 539
- **Global namespace:** `NumberMerge`
- **Canvas size:** 390×844 virtual px

## State Machine
- `MENU` — full-screen overlay with "2048" title, instructions, and "TAP TO PLAY" button
- `PLAYING` — interactive grid; swipe input drives tile movement
- `WIN` — overlay over the grid when any tile reaches 2048; "KEEP GOING" allows continued play
- `DEAD` — overlay when no empty cells remain and no merges are possible

Transitions:
- `MENU` → `PLAYING` on any swipe/tap
- `PLAYING` → `WIN` when a tile value reaches or exceeds 2048 (first occurrence only; `_winShown` flag prevents re-trigger)
- `PLAYING` → `DEAD` when grid is full and `_hasMoves()` returns false
- `WIN`/`DEAD` → `PLAYING` on swipe (with interstitial shown first via `AdManager.showInterstitial`)

## Core Variables
- `_score` — sum of all merge values accumulated this session
- `_best` — highest score ever; updated in `_move()` when `_score > _best`
- `_winShown` — boolean; prevents repeated WIN state on continued play after 2048
- `_grid` — 4×4 array (`[row][col]`) of integer values (0 = empty)
- `_anims` — array of `{ r, c, t }` objects tracking merge pop animations
- `_state` — current state string
- `_canvas`, `_ctx` — canvas references
- `CELL = 78` — tile size in px
- `GAP = 12` — gap between tiles in px
- `GRID_X = 9`, `GRID_Y = 240` — pixel position of grid top-left corner
- `MERGE_ANIM_DUR = 0.15` — duration of tile pop animation in seconds

## Key Functions
- `init(canvas, best)` — stores canvas, sets `_best`, calls `_resetGame()`, sets `_state = 'MENU'`
- `_resetGame()` — zeroes score and grid, spawns 2 initial tiles via `_spawnTile()`
- `update(dt)` — dt capped at 0.05s; advances merge pop animations in `_anims`
- `draw()` — clears to `BG_COLOR` (`#faf8ef`), calls `_drawHeader()`, `_drawGrid()`, then any active overlay
- `swipe(dx, dy)` — main input handler; dx/dy each -1/0/1; routes to state transitions or calls `_move()`
- `_move(dx, dy)` — applies slide logic for all four directions, calls `_compressLine()` per row/col, updates score, queues animations, spawns new tile, checks WIN/DEAD
- `_compressLine(line)` — compresses a 1D array leftward: filters zeros, merges adjacent equal pairs, returns `{ result, mergedScore, mergedPositions }`
- `_hasMoves()` — checks if any horizontal or vertical adjacent pair can merge; used for DEAD detection
- `_spawnTile()` — places a 2 (90% chance) or 4 (10% chance) in a random empty cell
- `_drawGrid(ctx)` — draws grid background, empty cells, non-animated tiles, then animated tiles on top with scale transform
- `_drawTile(ctx, r, c, v, scale)` — draws a single rounded-rect tile with color from `TILE_COLORS`, text with size from `_tileFontSize(v)`
- `_roundRect(ctx, x, y, w, h, r)` — manual rounded-rectangle path helper (no native API used)
- `_drawHeader(ctx)` — renders "2048" title, subtitle, SCORE box, and BEST box
- `_drawMenuOverlay`, `_drawDeadOverlay`, `_drawWinOverlay` — full state overlays
- `getScore()`, `getState()`, `getBest()` — public accessors

## Difficulty Scaling
No difficulty scaling — the game is purely skill-based. Tile spawn rate is fixed (one new tile per valid move). The 90%/10% split between spawning 2 vs 4 is constant throughout.

## localStorage Keys
None stored directly in game.js. Best score is passed in via `init(canvas, best)` and returned via `getBest()`. The host page persists it (expected key: `nummerge_best` as referenced in `AdManager.offerDoubleScore`).

## Dependencies
- `Audio.play('power')` — played when a merge produces a tile ≥ 2048
- `Audio.play('gem')` — played when a merge produces a tile ≥ 1024
- `Audio.play('score')` — played when a merge produces a tile ≥ 8
- `Audio.play('tap')` — played on any move (and on state transitions)
- `Audio.play('button')` — played on game start and restart
- `AdManager.gameplayStart()` — called on first swipe from MENU or after restart
- `AdManager.gameplayStop()` — called on WIN or DEAD
- `AdManager.onRunEnd()` — called alongside `gameplayStop()`
- `AdManager.showInterstitial(() => {})` — called on DEAD; also wraps restart on WIN/DEAD swipe
- `AdManager.offerDoubleScore(getScore(), 'nummerge_best')` — called on DEAD
