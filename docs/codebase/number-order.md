# Number Order — Codebase Reference

## Overview
Number Order is a timed arithmetic quiz game where the player taps the correct answer from four choices displayed on screen. Speed and accuracy earn more points, and a streak bonus rewards consecutive correct answers.

## File: js/game.js
- **Lines:** 348
- **Global namespace:** `NumberOrder`
- **Canvas size:** 390×844 virtual px

## State Machine
- `MENU` — title screen with "NUMBER / ORDER" heading, instructions, and best score
- `PLAYING` — active quiz with timer bar, question text, and four answer buttons
- `DEAD` — game over overlay rendered on top of the PLAYING background

Transitions:
- `MENU` → `PLAYING` on tap (calls `startGame()`)
- `PLAYING` → `DEAD` when `lives` reaches 0 (via `endGame()`)
- `DEAD` → `PLAYING` on tap (calls `startGame()`)

Note: the DEAD state draws on top of the PLAYING state — both branches render in `draw()`.

## Core Variables
- `score` — accumulated points for this run
- `lives` — starts at 3; decremented on wrong answer or timeout
- `streak` — consecutive correct answers; resets to 0 on wrong answer or timeout
- `best` — highest score ever; updated in `tap()` and `endGame()`
- `question` — object `{ text, correct, answers: [{val, x, y, w, h}] }` for current question
- `timeLeft` — seconds remaining for current question; starts at `QUESTION_TIME = 4`
- `qCount` — total questions answered this session (displayed as "Q N")
- `flashIdx` — index (0–3) of the button currently flashing; -1 when none
- `flashCorrect` — boolean; true = green flash, false = red flash
- `flashTimer` — seconds remaining in the button flash animation (0.45s correct, 0.3s wrong/death)
- `QUESTION_TIME = 4` — seconds per question
- `BTN_W = 160`, `BTN_H = 70` — answer button dimensions in px

## Key Functions
- `init(c, b)` — stores canvas context and best score; sets `state = 'MENU'`
- `startGame()` — resets score/lives/streak/qCount, generates first question, sets `state = 'PLAYING'`, fires `AdManager.gameplayStart()`
- `update(dt)` — dt capped at 0.05s; decrements `flashTimer` (during which timer is paused); then decrements `timeLeft`; on timeout decrements lives, calls `nextQuestion()` or `endGame()`
- `draw()` — dark background; MENU branch returns early; PLAYING draws timer bar, HUD, streak indicator, question text, and 4 answer buttons; DEAD overlay is drawn on top of PLAYING content
- `tap(x, y)` — MENU/DEAD restart; PLAYING does hit-test against each `question.answers` button, evaluates correct/wrong, applies scoring and flash
- `generateQuestion()` — selects operation based on score threshold (`getOps()`), computes correct answer, builds 3 plausible wrong answers within ±6 of correct, shuffles all 4, lays out 2×2 grid at `VH * 0.55`
- `nextQuestion()` — increments `qCount`, calls `generateQuestion()`, resets `timeLeft` and flash state
- `endGame()` — updates `best`, sets `state = 'DEAD'`, plays `lose` sound, fires AdManager calls
- `getOps()` — returns available operators based on score: `['+']` by default, adds `'-'` at score ≥ 20, adds `'x'` (×) at score ≥ 50
- `drawButton(btn, idx)` — draws a rounded-rect button with flash color state (green `#145214` or red `#521414`)
- `drawLives()` — draws three ♥/♡ hearts at top-left
- `roundedRect(x, y, w, h, rad)` — canvas path helper for rounded rectangles
- `getBest()` — returns current best value

## Difficulty Scaling
- New operators unlock by score threshold: subtraction at score ≥ 20, multiplication at score ≥ 50
- Time pressure is constant at 4 seconds per question (no speed-up)
- Scoring is time-weighted: `pts = max(5, floor(10 * timeLeft / QUESTION_TIME))`, so faster answers score more
- Streak bonus: every 3rd consecutive correct answer adds +5 pts

## localStorage Keys
None stored directly in game.js. Best is passed via `init` and returned by `getBest()`. Host page expected key: `numberorder_best` (referenced in `AdManager.offerDoubleScore`).

## Dependencies
- `Audio.play('tap')` — played on any button tap
- `Audio.play('gem')` — played on correct answer
- `Audio.play('crash')` — played on wrong answer or timeout
- `Audio.play('lose')` — played in `endGame()`
- `AdManager.gameplayStart()` — called in `startGame()`
- `AdManager.gameplayStop()` — called in `endGame()`
- `AdManager.onRunEnd()` — called in `endGame()`
- `AdManager.showInterstitial(() => {})` — called in `endGame()`
- `AdManager.offerDoubleScore(score, 'numberorder_best')` — called in `endGame()`
