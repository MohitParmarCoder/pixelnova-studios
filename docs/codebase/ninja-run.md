# Ninja Run — Codebase Reference

## Overview
Ninja Run is a rope-swing climbing game where the player launches their character between anchor points to ascend as high as possible. The player taps to release from a swinging rope and re-attach to a nearby anchor, scoring a point each time they successfully climb to a higher anchor.

## File: js/game.js
- **Lines:** 340
- **Global namespace:** `NinjaRun`
- **Canvas size:** 390×844 virtual px

## State Machine
- `MENU` — title screen with pulsing "TAP TO PLAY" prompt and best score display
- `PLAYING` — active gameplay; player swings on rope or flies through air
- `DEAD` — game over overlay shown; tap restarts game

Transitions:
- `MENU` → `PLAYING` on tap
- `PLAYING` → `DEAD` when `lives` reaches 0 (inside `loseLife()`)
- `DEAD` → `PLAYING` on tap (calls `startGame()`)

## Core Variables
- `score` — number of higher-anchor landings accumulated this run
- `lives` — starts at 3; decremented in `loseLife()` on fall-off-screen
- `best` — highest score ever (passed in via `init`, updated on new high)
- `angle` — pendulum angle in radians from vertical
- `angularVelocity` — rate of angle change per second
- `ropeLen` — fixed at 140 virtual px
- `anchorIdx` — index into `anchors[]` of the currently attached anchor
- `flying` — boolean; `true` when player is in free-flight (rope detached)
- `camY` — world-space Y offset; camera follows player upward
- `player` — `{ x, y, vx, vy }` object
- `anchors` — array of `{ x, y, r:14 }` objects
- `particles` — array of `{ x, y, vx, vy, life, maxLife, color }` objects

## Key Functions
- `init(canvas, bestScore)` — stores canvas context, sets `best`, enters `MENU` state
- `startGame()` — resets score/lives/camY, calls `genAnchors()`, sets `state = 'PLAYING'`, fires `AdManager.gameplayStart()`
- `update(dt)` — dt capped at 0.05s; runs pendulum physics or free-flight gravity; checks anchor collisions; scrolls camera; calls `loseLife()` on fall
- `draw()` — clears canvas dark (`#04050e`), draws star field, anchors with glow, rope line, player sprite, particles, HUD; overlays MENU or DEAD screens
- `tap(x, y)` — in MENU/DEAD restarts; in PLAYING toggles `flying` or manually snaps to nearest anchor in range
- `loseLife()` — decrements `lives`, spawns red particles, plays `crash` sound; if `lives <= 0` triggers DEAD + ad calls
- `genAnchors()` — seeds initial 6 anchors at hardcoded positions
- `addMoreAnchors()` — appends 3 new randomly placed anchors above the topmost existing anchor when player nears the top
- `attachToAnchor(idx)` — converts flying velocity into angular velocity on the new anchor
- `spawnParticles(x, y, col)` — emits 10 particles in random directions
- `drawHUD()` — draws heart row (♥/♡) top-left and score top-right at 26px bold

## Difficulty Scaling
No explicit difficulty ramp. Rope length (`ropeLen`) is fixed at 140 throughout. The procedural anchor generation via `addMoreAnchors()` always places new anchors 100–200 px above the last, with random X from 50 to 340, keeping spacing consistent. Score itself reflects skill, not speed increase.

## localStorage Keys
None stored directly in game.js. The `best` value is passed in from the host page via `init(canvas, bestScore)` and returned via `getBest()`. The host page is responsible for persisting it (expected key: `ninjarun_best` as referenced in `AdManager.offerDoubleScore`).

## Dependencies
- `Audio.play('crash')` — played on life loss
- `Audio.play('lose')` — played on game over
- `Audio.play('gem')` — played on successful anchor climb
- `Audio.play('tap')` — played on any tap during PLAYING
- `AdManager.gameplayStart()` — called in `startGame()`
- `AdManager.gameplayStop()` — called in `loseLife()` when lives reach 0
- `AdManager.onRunEnd()` — called alongside `gameplayStop()` on death
- `AdManager.showInterstitial(() => {})` — called on death
- `AdManager.offerDoubleScore(score, 'ninjarun_best')` — called on death
