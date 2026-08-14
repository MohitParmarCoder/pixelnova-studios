# Pixel Trace — Codebase Reference

## Overview
Pixel Trace is a dot-to-dot drawing game where players tap numbered dots in sequence (1 to 15) to trace a shape. Each round has a 20-second timer, and tapping the wrong dot costs a life; completing all 15 dots in order advances to the next layout.

## File: js/game.js
- **Lines:** ~371
- **Global namespace:** `PixelTrace`
- **Canvas size:** 390×844 virtual px

## State Machine
- `'MENU'` — title screen with pulsing "TAP TO PLAY" prompt; best score shown if > 0
- `'PLAYING'` — active gameplay; sub-state `_showComplete >= 0` signals round complete and triggers a 1.2s celebration before advancing
- `'DEAD'` — game over overlay with score/best; tap to call `init()` and return to MENU

Transitions:
- MENU → PLAYING via `_startGame()` on any tap
- PLAYING → DEAD via `_endGame()` when `_lives <= 0` (wrong tap or timer expiry)
- PLAYING internal: layout advances by incrementing `_layoutIdx` after `_showComplete > 1.2`
- DEAD → MENU via `init(_canvas, _best)` on any tap

## Core Variables
| Variable | Purpose |
|----------|---------|
| `_score` | Current cumulative score (increments by 1 per correct dot hit) |
| `_lives` | Remaining lives (starts at 3, max 3) |
| `_best` | All-time high score, passed in from localStorage |
| `_nextDot` | The number of the dot the player must tap next (1–15) |
| `_dots` | Array of 15 dot objects: `{ x, y, num, hit }` |
| `_lines` | Array of drawn connection lines: `{ x1, y1, x2, y2 }` |
| `_timeLeft` | Countdown in seconds for current round (resets to `TIME_LIMIT = 20`) |
| `_layoutIdx` | Index into `LAYOUTS` array (cycles through star, house, fish patterns) |
| `_showComplete` | Timer for "COMPLETE!" celebration (-1 = not showing; ≥0 = animating) |
| `_wrongFlash` | Countdown for red screen-flash on wrong tap (0.4s) |
| `_pulseT` | Accumulated time for sine-wave pulse animations |

## Key Functions
- `init(canvas, bestScore)` — sets state to `'MENU'`, resets score/lives/layout, calls `_newRound()`
- `tap(tapX, tapY)` — main input handler: routes to `_startGame()`, `init()`, or dot hit-test logic
- `_startGame()` — resets score/lives/layoutIdx, calls `_newRound()`, fires `AdManager.gameplayStart()`
- `_endGame()` — fires `AdManager.gameplayStop()`, `AdManager.onRunEnd()`, `AdManager.showInterstitial()`, `AdManager.offerDoubleScore(_score, 'pixeltrace_best')`, sets state `'DEAD'`
- `_newRound()` — calls `_makeDots(_layoutIdx)`, resets `_nextDot = 1`, `_lines = []`, `_timeLeft = TIME_LIMIT`
- `_makeDots(layoutIdx)` — maps normalised layout coords to canvas pixels inside play area (AREA_X1=30, AREA_X2=360, AREA_Y1=160, AREA_Y2=800)
- `update(dt)` — clamps dt, advances `_pulseT`, decrements `_wrongFlash`, handles `_showComplete` advance logic and timer countdown
- `draw()` — clears canvas, draws gradient background, routes to `_drawMenu()`, `_drawGame()`, `_drawDead()`
- `_drawGame(ctx)` — draws title, score, lives, timer bar, "Next: N" indicator, wrong-flash overlay, connection lines, and all dots
- `_drawLives(ctx, rightX, y)` — renders 3 heart symbols (♥/♡) in top-right
- `_fillRoundRect(ctx, x, y, w, h, r)` — utility for rounded rectangles (used for timer bar)
- `_text(ctx, str, x, y, size, color, align, glow)` — utility for glowing bold text
- `_dist(ax, ay, bx, by)` — Euclidean distance helper used for tap hit-testing
- `getBest()` — returns `_best` for persistence by main.js

## Difficulty Scaling
- Layout cycles through three preset patterns (star → house → fish → star …) via `_layoutIdx++` after each complete round
- No speed scaling — timer stays fixed at 20s per round
- Difficulty comes from increasing layout complexity as patterns change and the score pressure of the fixed timer

## localStorage Keys
- `pixeltrace_best` — used as the second argument to `AdManager.offerDoubleScore()`; actual read/write handled by the host (main.js)

## Dependencies
- `Audio.play('gem')` — called on correct dot tap
- `Audio.play('crash')` — called on wrong dot tap
- `Audio.play('lose')` — called when round timer expires
- `AdManager.gameplayStart()` — called at start of each game session
- `AdManager.gameplayStop()` — called on game over
- `AdManager.onRunEnd()` — called on game over
- `AdManager.showInterstitial(cb)` — called on game over
- `AdManager.offerDoubleScore(score, 'pixeltrace_best')` — called on game over
