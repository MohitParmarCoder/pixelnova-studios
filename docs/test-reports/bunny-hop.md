# Test Report: Bunny Hop

## Test Summary

| Category | Status |
|---|---|
| State transitions | Pass |
| Physics correctness | Pass |
| Platform generation | Pass |
| Scoring logic | Pass |
| Ad integration | Pass |
| localStorage persistence | Pass |
| Edge cases | Partial |

## State Transition Tests

### MENU → PLAYING
- **Trigger**: First tap anywhere on canvas while in MENU state.
- **Expected**: `gameplayStart()` called, state becomes `'PLAYING'`, bunny initialized at starting position.
- **Result**: Pass.

### PLAYING → DEAD
- **Trigger**: `by > VH + BH` (bunny falls below bottom of screen).
- **Expected**: `die()` called, `gameplayStop()`, `onRunEnd()`, `showInterstitial()` triggered, score finalized.
- **Result**: Pass.

### DEAD → MENU
- **Trigger**: Tap on DEAD screen (outside double-score button).
- **Expected**: State resets to `'MENU'`, `score`, `scoreBase`, `carrotBonus`, `scrollY`, `platforms`, `carrots` all reset.
- **Result**: Pass.

## Physics Tests

### Gravity Application
- **Test**: Verify `bvy += GRAVITY * dt` each frame.
- **Expected**: With `GRAVITY = 1400` and `dt = 0.016`, `bvy` increases by ~22.4 px/s per frame.
- **Result**: Pass.

### Jump Gate
- **Test**: Tap mid-air when `bvy = -400` (fast upward) — jump should NOT re-trigger.
- **Expected**: `bvy` unchanged, `bvx` updated only.
- **Result**: Pass (`bvy > -200` condition correctly blocks).

### Jump Gate (marginal)
- **Test**: Tap mid-air when `bvy = -190` (barely off platform).
- **Expected**: `bvy` reset to `-750` (corrective jump allowed).
- **Result**: Pass.

### Horizontal Wrap
- **Test**: Drive bunny past right edge.
- **Expected**: Bunny appears at left edge with same `bvy`.
- **Result**: Pass.

## Platform Generation Tests

### Generation Ahead
- **Test**: At `scrollY = 0` and `scrollY = 3000`, confirm platforms exist up to `GEN_AHEAD = 950` px above `worldTopY`.
- **Result**: Pass.

### Platform Density
- **Test**: Confirm bunny can always reach the next platform (gap ≤ max jump height).
- **Expected**: Max jump height with `bvy = -750`, `GRAVITY = 1400` ≈ 201 px. Platform spacing must not exceed this.
- **Result**: Pass (generation logic enforces reachable gaps).

## Scoring Tests

### scoreBase
- **Test**: Set `scrollY = 500`, verify `scoreBase = 10`.
- **Result**: Pass (`500 / 50 = 10`).

### carrotBonus
- **Test**: Collect 3 carrots, verify `carrotBonus = 15` and `score = scoreBase + 15`.
- **Result**: Pass.

### Best Score Persistence
- **Test**: Achieve score > `best`, die, verify `localStorage.getItem('bunnyhop_best')` updated.
- **Result**: Pass.

### Best Score Not Overwritten
- **Test**: Achieve score < current `best`, die, verify localStorage unchanged.
- **Result**: Pass.

## Platform Speed Tests

| `scrollY` | Expected `platformSpeed` | Result |
|---|---|---|
| 0 | 60 | Pass |
| 2000 | 90 | Pass |
| 10000 | 210 | Pass |
| 20000 | 280 (capped) | Pass |

## Ad Integration Tests

### gameplayStart timing
- **Test**: Confirm `gameplayStart()` fires on MENU → PLAYING transition, not during DEAD → MENU.
- **Result**: Pass.

### Interstitial on death
- **Test**: Confirm `gameplayStop()`, `onRunEnd()`, `showInterstitial()` all called in `die()`.
- **Result**: Pass (order: stop → end → interstitial).

### offerDoubleScore
- **Test**: Double-score offer correctly passes current `score` and key `'bunnyhop_best'`.
- **Result**: Pass.

## Edge Cases

### Bunny on platform at start
- **Test**: `onPlatform = true` at spawn; first tap fires jump.
- **Result**: Pass.

### Carrot already collected
- **Test**: Confirm collected carrots (`collected = true`) are not counted again on re-overlap.
- **Result**: Pass.

### Zero score death
- **Test**: Die immediately without gaining height.
- **Expected**: `score = 0`, no crash, `best` unchanged if 0.
- **Result**: Pass.

### platformSpeed cap
- **Test**: At very large `scrollY`, speed never exceeds 280.
- **Result**: Pass.

## Known Gaps

- No automated headless test suite — all tests performed via manual browser session.
- No test for simultaneous multi-touch input (two fingers at once).
- Carrot spawning density at extreme `scrollY` values not load-tested.
