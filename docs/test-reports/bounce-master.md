# Bounce Master — Test Report

## Test Environment

- Runtime: Vanilla JS, Canvas2D, no build step
- Test method: Manual functional testing + code-level logic review
- Canvas size: 390 × 844 (virtual, letterboxed)
- Device targets: Mobile Chrome, Mobile Safari, Desktop Chrome

---

## State Transition Tests

| Test | Expected | Status |
|---|---|---|
| Tap on MENU starts game | State → PLAYING, `gameplayStart()` called | Pass |
| `lives <= 0` ends game | State → DEAD, `gameplayStop()` + `showInterstitial()` called | Pass |
| Tap on DEAD returns to MENU | State → MENU | Pass |

---

## Puck Physics Tests

| Test | Expected | Status |
|---|---|---|
| Puck hits left wall | `vx` flips sign | Pass |
| Puck hits right wall | `vx` flips sign | Pass |
| Puck hits top wall | `vy` flips sign | Pass |
| Puck hits bottom wall | `vy` flips sign | Pass |
| Puck speed exceeds `SPEED_CAP = 700` after repeated paddle hits | Both `vx` and `vy` clamped to 700 | Pass |
| Paddle lateral transfer: `vx += (puck.x - paddleX) * 0.3` | Off-center hits add spin | Pass |

---

## Scoring Tests

| Test | Expected | Status |
|---|---|---|
| Puck crosses `y < 60` (player scores) | `score += 10`, `playerGoals++` | Pass |
| `playerGoals >= 3` | +50 pts bonus, round resets, `playerGoals = 0` | Pass |
| Puck crosses `y > VH - 60` (AI scores) | `aiGoals++` | Pass |
| `aiGoals >= 3` | `lives--`, round resets, `aiGoals = 0` | Pass |
| `lives <= 0` | Transition to DEAD | Pass |

---

## AI Behavior Tests

| Test | Expected | Status |
|---|---|---|
| Puck moves left | `aiX` converges toward `puck.x` within ~20 frames | Pass |
| `dt` spike (tab switch) | `clamp(3 * dt, 0, 1)` prevents teleport | Pass |
| AI Y is fixed | `aiY` stays at `AI_Y = 120` throughout | Pass |

---

## Player Paddle Constraint Tests

| Test | Expected | Status |
|---|---|---|
| Drag paddle below `VH - 50` | Y clamped to `VH - 50` | Pass |
| Drag paddle above `VH/2 + 20` | Y clamped to `VH/2 + 20` | Pass |
| Drag in top half of screen | Paddle does not respond | Pass |

---

## Audio Tests

| Event | Expected Sound | Status |
|---|---|---|
| Player paddle hit | `'tap'` | Pass |
| Player goal | `'gem'` | Pass |
| AI goal | `'crash'` | Pass |
| `lives <= 0` | `'lose'` | Pass |

---

## Ad Integration Tests

| Hook | Trigger | Status |
|---|---|---|
| `gameplayStart()` | `startGame()` call | Pass |
| `gameplayStop()` | `lives <= 0` in `update()` | Pass |
| `onRunEnd()` | `lives <= 0` in `update()` | Pass |
| `showInterstitial()` | `lives <= 0` in `update()` | Pass |
| `offerDoubleScore(score, 'bouncemaster_best')` | DEAD screen render | Pass |

---

## Persistence Tests

| Test | Expected | Status |
|---|---|---|
| New high score | Written to `localStorage['bouncemaster_best']` | Pass |
| Existing best not overwritten on lower score | Read-then-compare before write | Pass |
| `localStorage` unavailable | Graceful fallback, no crash | Not verified — recommend adding try/catch |

---

## Known Issues

| Issue | Severity | Notes |
|---|---|---|
| No pause functionality | Medium | Player cannot pause mid-game |
| SPEED_CAP can cause instant goals | Low | Puck at 700 px/s crosses field in ~1.2 frames |
| No regression test suite | High | All tests are manual; recommend headless smoke test |
