# Sequence Game — Codebase Reference

## Overview
Sequence Game is a Mastermind code-breaker game. A 4-color secret code must be guessed in 6 attempts. After each guess, black pegs (right color, right position) and white pegs (right color, wrong position) guide the player. The global namespace is `SequenceGame` and the entire game logic is contained in `js/game.js`.

## File: js/game.js
- **Global namespace:** `SequenceGame`
- **Canvas size:** 390×844 virtual px
- **Dependencies:** Audio, AdManager, Input, UI (loaded before game.js)

## State Machine

```
MENU → PLAYING → DEAD
```

- `MENU` — title screen, shows best score, tap to start.
- `PLAYING` — active gameplay loop.
- `DEAD` — game over; shows score, triggers ad flow, offers double score.

## Core Variables

| Variable | Description |
|---|---|
| `score` | Current run score |
| `lives` | Player resource (lives) |
| `best` | All-time best score (from localStorage `sequencegame_best`) |
| `state` | Current state machine state string |

## Key Functions

- `init(canvas, bestScore)` — Initializes canvas reference, sets `best`, resets to `MENU`.
- `startGame()` — Resets score and state variables, calls `AdManager.gameplayStart()`, transitions to `PLAYING`.
- `update(dt)` — Main update loop; clamps dt to 0.05s max. Handles all game logic, spawning, and collision.
- `draw()` — Renders all game elements to canvas each frame.
- `tap(x, y)` / `onInput(x, y)` — Handles player touch/click input.
- `endGame()` / death handler — Saves best, calls `gameplayStop()`, `onRunEnd()`, `showInterstitial()`, `offerDoubleScore()`.

## Difficulty Scaling
Difficulty increases progressively with score — spawn rates increase, speeds increase, windows shrink.

## localStorage Keys

| Key | Content |
|---|---|
| `sequencegame_best` | Highest score achieved |

## Ad Integration Points

| Event | AdManager Call |
|---|---|
| Game start | `AdManager.gameplayStart()` |
| Game over | `AdManager.gameplayStop()` |
| Run end | `AdManager.onRunEnd()` |
| Between runs | `AdManager.showInterstitial()` |
| DEAD screen | `AdManager.offerDoubleScore(score, 'sequencegame_best')` |

## Audio Sounds
Uses `Audio.play(name)` for key events. Common sounds: `'hop'`, `'gem'`, `'crash'`, `'lose'`.

## Rendering
All art is drawn procedurally using Canvas2D API. Zero image files. All coordinates in virtual 390×844 space; main.js applies CSS scaling to fit any screen.
