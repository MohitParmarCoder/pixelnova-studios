# Chain Tap — Test Report

## Test Summary

| Category | Status |
|---|---|
| State transitions | Pass |
| Round generation | Pass |
| Tap sequence logic | Pass |
| Timer mechanics | Pass |
| Lives system | Pass |
| Score persistence | Pass |
| Ad calls | Pass |
| Edge cases | Partial |

## State Transition Tests

### MENU → PLAYING
- Tap start button calls `startGame()`
- `lives` resets to 3, `score` resets to 0, `round` resets to 1
- `gameplayStart()` is called exactly once
- `circles` array is populated; `nextNum` is 1

### PLAYING → DEAD
- Triggered when `lives` reaches 0 after wrong tap or timeout
- `gameplayStop()`, `onRunEnd()`, `showInterstitial()` called in sequence
- Best score updated: `best = max(best, score)`, written to `chaintap_best`

### DEAD → MENU
- Tap restarts state to MENU
- `circles` array is cleared

## Round Generation Tests

| Round | Expected `n` | Timer |
|---|---|---|
| 1 | 6 | 19 s |
| 7 | 12 | 13 s |
| 15 | 12 | 8 s |

- `n = min(5 + round, 12)` verified for rounds 1, 7, 15
- Timer floor of 8 s verified at round >= 12

## Tap Sequence Tests

- Tapping `circle.num === nextNum` increments `nextNum`
- Tapping out of order decrements `lives`, plays `'crash'`
- Tapping already-tapped circle: no effect expected (tapped flag check)
- Completing all `n` circles: `score++`, `round++`, `newRound()` delayed 500 ms

## Timer Tests

- Timer decrements by `dt` each frame
- At `timer <= 0`: `lives--`, `newRound()` called (or DEAD if `lives === 0`)
- Timer bar width = `(timer / startTimer) * canvasWidth`, clamped to [0, 1]
- Color thresholds: green above 50%, yellow 25–50%, red below 25%

## Audio Tests

| Scenario | Expected Sound |
|---|---|
| Correct tap | `'tap'` |
| Wrong tap | `'crash'` |
| Round complete | `'gem'` |
| Timer out | `'lose'` |

## Edge Cases

| Case | Status | Notes |
|---|---|---|
| Wrong tap on last life | Pass | Transitions to DEAD |
| Timeout on last life | Pass | Transitions to DEAD |
| Round 12+ circles capped at 12 | Pass | `min(5+round,12)` |
| Timer floor at 8 s | Pass | `max(8, 20-round)` |
| Circles overlapping | Not tested | Random placement has no overlap prevention |
| Very fast taps (double-tap) | Not tested | Could skip `nextNum` by two |

## Known Issues

1. **Circle overlap**: random placement does not check for overlap; dense rounds may produce stacked circles
2. **Double-tap race**: two rapid taps on the correct circle may register twice if tap handler does not debounce
