# Chain Tap — Codebase Reference

## Overview

- **Global**: `ChainTap`
- **File size**: ~142 lines
- **Tech**: Vanilla JS, HTML5 Canvas, no dependencies

## State Machine

```
MENU → PLAYING → DEAD
```

State transitions:
- `MENU` → `PLAYING`: tap start button → `startGame()`
- `PLAYING` → `DEAD`: `lives` reaches 0
- `DEAD` → `MENU`: tap to return

## Key Variables

| Variable | Type | Description |
|---|---|---|
| `score` | number | Rounds completed |
| `best` | number | All-time best, persisted to `chaintap_best` |
| `lives` | number | Starts at 3; decrements on wrong tap or timeout |
| `circles` | array | Active circles: `{num, x, y, r=32, tapped, color}` |
| `nextNum` | number | The number the player must tap next |
| `round` | number | Current round index (1-based) |
| `timer` | number | Countdown in seconds; starts at `max(8, 20 - round)` |

## Core Mechanics

### Round Setup (`newRound()`)
- Calculates `n = min(5 + round, 12)` circles to place
- Scatters circles randomly within canvas bounds
- Resets `nextNum = 1` and `timer = max(8, 20 - round)`

### Tap Handling
- Correct tap (`circle.num === nextNum`): `nextNum++`, plays `'tap'` audio
- Wrong tap: `lives--`, plays `'crash'` audio
- Round complete (all tapped in order): `score++`, `round++`, plays `'gem'`, calls `newRound()` after 500 ms delay
- Timer expires: `lives--`, plays `'lose'`, calls `newRound()` or transitions to `DEAD` if `lives <= 0`

### Visual Indicators
- **Timer bar**: Bottom of canvas; color transitions green → yellow → red as time depletes
- **Active circle**: Highlighted with a dashed ring
- **Target prompt**: Displays `'Tap: N →'` text showing current `nextNum`

## Audio Calls

| Event | Sound |
|---|---|
| Correct tap | `'tap'` |
| Wrong tap | `'crash'` |
| Round complete | `'gem'` |
| Timer timeout | `'lose'` |

## Ad Integration

| Trigger | Call |
|---|---|
| Game start | `gameplayStart()` |
| Player death (`lives <= 0`) | `gameplayStop()`, `onRunEnd()`, `showInterstitial()` |
| End screen | `offerDoubleScore(score, 'chaintap_best')` |

## localStorage

| Key | Value |
|---|---|
| `chaintap_best` | Highest `score` achieved |
