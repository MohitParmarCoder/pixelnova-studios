# Bowling Strike — Codebase Reference

## Overview

Global: `BowlingStrike`. ~511 lines. Vanilla JS + Canvas2D. No build step, no dependencies.

## State Machine

```
MENU → PLAYING → DEAD
DEAD (tap) → MENU
```

- **MENU**: Title screen, tap to start.
- **PLAYING**: Bowling gameplay across `totalFrames = 3` frames.
- **DEAD**: End-of-game screen, final score, double score offer.

## Key Variables

| Variable | Default | Description |
|---|---|---|
| `score` | 0 | Accumulated pin-knock count |
| `totalFrames` | 3 | Total frames per game |
| `frame` | 0 | Current frame index |
| `shot` | 0–1 | Shot index within current frame (0 = first, 1 = second) |
| `pinsStanding` | 10 bools | Array of 10 booleans; `true` = pin still standing |
| `pinPositions` | Array | Triangle layout: 4-3-2-1 rows of `{x, y}` positions |
| `ballX/Y` | VH-80 | Ball starting position |
| `ballVX/VY` | — | Ball velocity components |
| `ballCurve` | ±0.03 | Random curve applied each shot |
| `tapPhase` | 0 or 1 | `0` = aim phase, `1` = shoot phase |
| `aimX` | — | X position of aim dot/line (set by first tap) |
| `laneY` | 120 | Y coordinate of the pin deck (top of lane) |
| `flashTimer` | — | Timer for flash overlay after knockdown |
| `flashColor` | — | Color of flash overlay |
| `msgText` | string | Message to display ("STRIKE!", "SPARE!", "GUTTER!") |
| `msgTimer` | — | Duration to show `msgText` |

## Constants

| Constant | Value | Purpose |
|---|---|---|
| `BALL_R` | 20 | Ball radius in px |
| `PIN_R` | 10 | Pin radius in px |
| `PIN_COUNT` | 10 | Total pins per frame |

## Core Mechanics

### Two-Tap Shooting
1. **First tap** (aim phase, `tapPhase = 0`): Sets `aimX`. Displays a dotted guide line from ball to lane.
2. **Second tap** (shoot phase, `tapPhase = 1`): Launches ball upward at fixed speed 7. `ballCurve` is randomized `±0.03` per shot.

### Ball Movement
- Ball moves upward (`vy = -7`) with no gravity.
- `ballX += ballCurve` each frame — slight horizontal drift.
- Lane scrolls visually while ball is in flight (no actual coordinate change needed).

### Pin Knockdown — `knockPins()`
- Called when ball reaches `laneY + 80`.
- `spread = 60 + random * 40`.
- Any pin with `distance(ball, pin) < spread` is knocked down (`pinsStanding[i] = false`).
- `score += knockedCount`.
- Result classification:
  - All 10 knocked on first shot → `"STRIKE"` message, `'gem'` sound.
  - 7+ knocked → `"SPARE"` message, `'gem'` sound.
  - 0 knocked → `"GUTTER"` message, `'lose'` sound.
  - Otherwise → `'crash'` sound.

### Frame Progression — `nextShot()`
- After 2 shots, or after a STRIKE, resets pins and advances to next frame.
- When `frame >= totalFrames` → `gameplayStop()` + `onRunEnd()` + `showInterstitial()` → DEAD state.

## Pin Layout

Pins are arranged in a 4-3-2-1 triangle pointing toward the top of the screen (toward `laneY`). `pinPositions` stores the `{x, y}` for each of the 10 pins.

## Audio Cues

| Event | Sound Key |
|---|---|
| Aim tap or shoot tap | `'tap'` |
| Pins knocked down | `'crash'` |
| STRIKE or SPARE | `'gem'` |
| Gutter ball | `'lose'` |

## Ad Integration

| Hook | When Called |
|---|---|
| `gameplayStart()` | Inside `startGame()` |
| `gameplayStop()` | In `nextShot()` when `frame >= totalFrames` |
| `onRunEnd()` | In `nextShot()` when `frame >= totalFrames` |
| `showInterstitial()` | In `nextShot()` when `frame >= totalFrames` |
| `offerDoubleScore(score, 'bowlingstrike_best')` | On DEAD screen |

## Persistence

- `localStorage` key: `'bowlingstrike_best'`
- Stores the player's all-time high pin-knock score.

## File Structure

Single self-contained JS file exposing the `BowlingStrike` global. Expected to be loaded via `<script>` with shared audio, ads, and input modules available.
