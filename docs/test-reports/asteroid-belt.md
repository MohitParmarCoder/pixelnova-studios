# Asteroid Belt — Test Report

## Test Environment
- **Platform:** HTML5 Canvas, vanilla JS
- **Global:** `AsteroidBelt`
- **Test method:** Manual functional testing + headless syntax check
- **Canvas size:** 390×844 virtual px

## Syntax Check
```bash
node --check js/game.js
```
Pass criteria: exits 0, no output.

## Smoke Test Checklist

| # | Test | Expected | Status |
|---|---|---|---|
| 1 | Page loads, canvas renders | Star field (100 stars) and ship visible | Verify |
| 2 | `AsteroidBelt` global defined | `typeof AsteroidBelt === 'object'` | Verify |
| 3 | MENU state on load | Title screen shown, no asteroids | Verify |
| 4 | Tap/drag on MENU starts game | State → `PLAYING`, `gameplayStart()` called | Verify |
| 5 | Ship follows drag | `playerX/Y` lerps toward `playerTargetX/Y` each frame | Verify |
| 6 | Asteroid spawns from edges | Asteroids appear from all 4 screen edges, travel toward center | Verify |
| 7 | Asteroid spawn interval decreases with `tick` | Interval: `max(0.5, 1.6 - tick*0.025)`; verify at tick=0 (~1.6s) and tick=44 (~0.5s) | Verify |
| 8 | Crystal spawns every 2.2s | `crystalTimer` reaches 0, crystal appears; max 5 simultaneous | Verify |
| 9 | Crystal collect within r=14px | `score++`, `'gem'` sound, crystal removed | Verify |
| 10 | Asteroid collision → lose life | `lives--`, flash, `'crash'` sound, `showInterstitial()` called | Verify |
| 11 | 3 lives lost → DEAD | State → `DEAD`; `gameplayStop()` and `onRunEnd()` called | Verify |
| 12 | Best score persisted | `localStorage.getItem('asteroidbelt_best')` updated when score exceeds prior best | Verify |
| 13 | Asteroid speed scales with tick | Speed matches `80 + random*80 + tick*0.04`; noticeably faster after 30s | Verify |
| 14 | `offerDoubleScore` on DEAD | `offerDoubleScore(score, 'asteroidbelt_best')` called | Verify |
| 15 | Asteroids culled off-screen | `asteroids` array does not grow unboundedly; off-screen entries removed | Verify |

## Known Edge Cases

### Crystal Spawn in Dense Asteroid Field
At high `tick`, a freshly spawned crystal may be immediately surrounded by asteroids, making collection impossible. No fail-safe in `spawnCrystal()` currently checks for asteroid proximity. Document as known limitation.

### Ship Teleport on Large `dt`
If `dt` is very large (e.g., tab backgrounded), `min(1, dt*7)` clamps the lerp to 1, causing the ship to teleport to `playerTargetX/Y` instantly. Verify this does not cause a collision with an asteroid that the player could not reasonably avoid.

### Five-Crystal Cap Timing
`spawnCrystal()` is called when `crystalTimer <= 0`, but it only spawns if `crystals.length < 5`. If the array is full, the timer resets anyway. Verify the timer interval still resets correctly so the check fires again after 2.2s.

### Simultaneous Collision
If two asteroids hit the player in the same `update(dt)` frame, `loseLife()` may be called twice in rapid succession, potentially skipping directly from 2 lives to 0. Verify collision loop breaks or sets invincibility flag after first hit.

## Audio Test Matrix

| Event | Sound | Condition |
|---|---|---|
| Crystal collected | `'gem'` | Player within r=14px of crystal |
| Asteroid hit | `'crash'` | Player collides with asteroid |

## Ad Integration Tests

| Call | Trigger | Verified By |
|---|---|---|
| `gameplayStart()` | `startGame()` | AdManager log on new run |
| `showInterstitial()` | Each `loseLife()` | Frequency cap enforced by AdManager |
| `gameplayStop()` | `lives <= 0` | AdManager log on death |
| `onRunEnd()` | `lives <= 0` | AdManager log on death |
| `offerDoubleScore(score,'asteroidbelt_best')` | DEAD entry | Double-score UI shown |
