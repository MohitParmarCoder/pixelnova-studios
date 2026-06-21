# Bounce Master — Codebase Reference

## Overview

Global: `BounceMaster`. ~375 lines. Vanilla JS + Canvas2D. No build step, no dependencies.

## State Machine

```
MENU → PLAYING → DEAD
DEAD (tap) → MENU
```

- **MENU**: Title screen, tap to start.
- **PLAYING**: Air hockey gameplay loop.
- **DEAD**: Game over screen, shows final score, offers double score.

## Key Variables

| Variable | Description |
|---|---|
| `score` | Current score, +10 per player goal, +50 on round win |
| `lives` | Starts at 3; decremented when `aiGoals >= 3` |
| `puck` | Object `{x, y, vx, vy}` — puck position and velocity |
| `playerX/Y` | Player paddle position; Y fixed at `PLAYER_Y = VH - 80` |
| `aiX/Y` | AI paddle position; Y fixed at `AI_Y = 120` |
| `playerGoals` | Goals scored by player in current round (resets each round) |
| `aiGoals` | Goals scored by AI in current round (resets each round) |
| `particles` | Array of visual particle effects |
| `pulseT` | Timer used for UI pulse animations |

## Constants

| Constant | Value | Purpose |
|---|---|---|
| `PUCK_R` | 20 | Puck radius in px |
| `PADDLE_R` | 30 | Paddle radius in px |
| `SPEED_CAP` | 700 | Maximum puck velocity (vx or vy) |
| `AI_GOAL_LIMIT` | 3 | Goals AI must score to win a round |
| `PLAYER_GOAL_LIMIT` | 3 | Goals player must score to win a round |

## Core Mechanics

### Player Input
- Tap or drag moves the player paddle.
- Paddle Y is clamped to the bottom half: `VH/2 + 20 .. VH - 50`.
- Paddle X follows pointer X freely.

### AI Behavior
- AI paddle tracks the puck X position with exponential lag:
  ```js
  aiX += (puck.x - aiX) * clamp(3 * dt, 0, 1)
  ```
- AI Y is fixed at `AI_Y = 120`.

### Puck Physics
- Bounces off left/right walls (vx flip).
- Bounces off top/bottom walls (vy flip).
- On paddle collision: `vx += (puck.x - paddleX) * 0.3`, then both vx and vy are capped at `SPEED_CAP = 700`.

### Scoring & Rounds
- Player goal: `puck.y < 60` — awards +10 pts, increments `playerGoals`.
- If `playerGoals >= 3`: round win, +50 pts bonus, reset round.
- AI goal: `puck.y > VH - 60` — increments `aiGoals`.
- If `aiGoals >= 3`: `lives--`, reset round.
- If `lives <= 0`: transition to `DEAD` state.

## Audio Cues

| Event | Sound Key |
|---|---|
| Player paddle hit | `'tap'` |
| Player scores a goal | `'gem'` |
| AI scores a goal | `'crash'` |
| Player death (lives = 0) | `'lose'` |

## Ad Integration

| Hook | When Called |
|---|---|
| `gameplayStart()` | Inside `startGame()` on transition to PLAYING |
| `gameplayStop()` | In `update()` when `lives <= 0` |
| `onRunEnd()` | In `update()` when `lives <= 0` |
| `showInterstitial()` | In `update()` when `lives <= 0` |
| `offerDoubleScore(score, 'bouncemaster_best')` | On DEAD screen |

## Persistence

- `localStorage` key: `'bouncemaster_best'`
- Stores the player's all-time high score.

## File Structure

Single self-contained JS file exposing the `BounceMaster` global. Expected to be loaded as a `<script>` tag with access to a shared canvas, audio module, and ad manager.
