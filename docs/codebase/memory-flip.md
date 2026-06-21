# Memory Flip — Codebase Reference

## Overview
Memory Flip is a card-matching game where the player flips two cards at a time, trying to find matching symbol pairs. All pairs must be matched before a countdown timer runs out; failing the timer ends the game while clearing a level advances to the next with a larger grid.

## File: js/game.js
- **Lines:** ~677
- **Global namespace:** `MemoryFlip`
- **Canvas size:** 390×844 virtual px

## State Machine
- `'MENU'` — title screen with animated symbol row and floating title; tap starts game
- `'PLAYING'` — active gameplay; countdown timer ticking, cards flippable
- `'WIN'` — brief 1.4-second level-clear banner; tap fast-forwards to next level; transitions back to `'PLAYING'` after `winTimer` expires
- `'DEAD'` — time-up overlay; tap retries (shows interstitial first)

Transitions:
- `MENU` → tap → `PLAYING` (via `startGame()` / `resetGame()`)
- `PLAYING` → all cards matched → `WIN` (via `levelWin()`)
- `WIN` → `winTimer` <= 0 → `level++` → `PLAYING`
- `PLAYING` → `timeLeft` <= 0 → `DEAD` (via `gameOver()`)
- `DEAD` → tap → interstitial → `PLAYING`

## Core Variables
| Variable | Purpose |
|----------|---------|
| `score` | Current run score (resets to 0 on `resetGame()`) |
| `_best` | Best score across sessions (passed in via `init`) |
| `level` | Current level (1-indexed, increments on level win) |
| `timeLeft` | Seconds remaining for the current level |
| `levelTime` | Starting seconds for the current level (`max(30, 60 - (level-1)*5)`) |
| `cards[]` | Array of card objects `{ sym, x, y, w, h, flip, target, matched, pulse }` |
| `first`, `second` | Indices of the two currently selected cards (-1 = none) |
| `resolveTimer` | Countdown (0.6 s) before a mismatched pair flips back |
| `moves` | Number of flip-pairs attempted this level |
| `cols`, `rows` | Current grid dimensions |
| `FLIP_SPEED` | `1 / 0.18` — full flip animation in ~0.18 s |
| `MISMATCH_HOLD` | `0.6` s hold on mismatched pair before flipping back |
| `t` | Global animation time accumulator |

## Key Functions
- `init(canvas, best)` — stores canvas reference, sets `state = 'MENU'`, seeds `_best`
- `startGame()` — calls `resetGame()`, sets `state = 'PLAYING'`, calls `AdManager.gameplayStart()`
- `resetGame()` — zeroes score/level, calls `startLevel()`
- `startLevel()` — computes `levelTime`, zeroes `moves`/`first`/`second`/`resolveTimer`/`winTimer`, calls `buildBoard()`
- `buildBoard()` — calls `layoutGrid()`, shuffles symbol pairs, populates `cards[]`
- `layoutGrid()` — reads `gridForLevel(level)` config, computes `cardW`/`cardH`/`gridX`/`gridY`
- `gridForLevel(lv)` — returns `{c, r}` config from `[{4,4},{4,5},{4,6},{5,6}]`
- `update(dt)` — dt clamped to 0.05 s; animates `flip` toward `target`; ticks `winTimer`, `timeLeft`, `resolveTimer`
- `tap(vx, vy)` — handles state routing; in PLAYING: hit-tests cards, flips, evaluates match, scores, triggers `levelWin()` or mismatch hold
- `draw()` — routes to `drawMenu()`, `drawHUD()` + `drawBoard()`, `drawWinBanner()`, or `drawDead()`
- `drawCard(cd)` — renders horizontal-flip animation using `Math.cos(p * Math.PI)` scale trick; draws symbol or `?` back
- `drawSymbol(sym, cx, cy, s)` — draws one of 10 canvas-path symbols (star, heart, circle, triangle, diamond, square, bolt, moon, cross, ring)
- `drawHUD()` — score (top-centre), level (top-left), moves (top-right), timer bar with colour-coded fill, seconds label
- `allMatched()` — returns true when every card in `cards[]` has `matched === true`
- `levelWin()` — sets `state = 'WIN'`, adds time bonus (`floor(timeLeft) * 5`), plays `'power'` sound
- `gameOver()` — sets `state = 'DEAD'`, updates `_best`, plays `'lose'`, calls ad sequence
- `runEnded()` — calls `AdManager.gameplayStop()`, `onRunEnd()`, `showInterstitial()`, `offerDoubleScore(getScore(), 'memflip_best')`
- `getScore()` / `getState()` / `getBest()` — public test-hook accessors

## Difficulty Scaling
- Level 1: 4×4 grid (8 pairs), 60 s
- Level 2: 4×5 grid (10 pairs), 55 s
- Level 3: 4×6 grid (12 pairs), 50 s
- Level 4+: 5×6 grid (15 pairs), 45 s (capped at 30 s minimum via `max(30, 60-(level-1)*5)`)
- Score per match: `100 + floor(timeLeft)` (time bonus encourages speed)
- Level clear bonus: `floor(timeLeft) * 5`

## localStorage Keys
Memory Flip does not write localStorage directly. Best score is passed in via `init(canvas, best)` and the host (main.js) is responsible for reading/writing `'memflip_best'` (referenced in `AdManager.offerDoubleScore` call).

## Dependencies
- `Audio.play('flip')` — card flip sound
- `Audio.play('score')` — successful match sound
- `Audio.play('power')` — level clear sound
- `Audio.play('lose')` — time-up / game over sound
- `Audio.play('button')` — tap on MENU or DEAD screen
- `AdManager.gameplayStart()` — called in `startGame()` and when advancing to next level
- `AdManager.gameplayStop()` — called in `runEnded()`
- `AdManager.onRunEnd()` — called in `runEnded()`
- `AdManager.showInterstitial(cb)` — called in `runEnded()` and on tap from DEAD state
- `AdManager.offerDoubleScore(score, 'memflip_best')` — called in `runEnded()`
