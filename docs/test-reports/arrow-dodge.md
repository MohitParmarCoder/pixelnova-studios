# Arrow Dodge — Test Report

## Test Environment
- **Platform:** HTML5 Canvas, vanilla JS
- **Global:** `ArrowDodge`
- **Test method:** Manual functional testing + headless smoke checks via Node `--check`
- **Canvas size:** 390×844 virtual px

## Syntax Check
```bash
node --check js/game.js
```
Pass criteria: exits 0, no output.

## Smoke Test Checklist

| # | Test | Expected | Status |
|---|---|---|---|
| 1 | Page loads, canvas renders | Star field and archer visible at `(VW/2, 760)` | Verify |
| 2 | `ArrowDodge` global defined | `typeof ArrowDodge === 'object'` | Verify |
| 3 | MENU state on load | Title screen shown, no arrows in flight | Verify |
| 4 | Tap on MENU starts game | State transitions to `PLAYING`, `gameplayStart()` called | Verify |
| 5 | Tap during PLAYING fires arrow | Arrow appears from archer position, travels toward tap point | Verify |
| 6 | Cooldown prevents rapid fire | Second tap within 0.5s does not spawn arrow | Verify |
| 7 | Arrow affected by wind | Arrow path curves proportional to `wind` value | Verify |
| 8 | Target hit registers score | Score increments by `max(5, floor(distToArcher/30))` | Verify |
| 9 | Target exits bottom → lose life | `lives` decrements, flash triggers, `'crash'` sound plays | Verify |
| 10 | 3 lives lost → DEAD state | State transitions to `DEAD`, `gameplayStop()` and `onRunEnd()` called | Verify |
| 11 | High score persisted | `localStorage.getItem('arrowdodge_best')` updated if score exceeds previous best | Verify |
| 12 | Wind rescales at score 30, 60, 90 | Wind magnitude grows per tier formula | Verify |
| 13 | Target fall speed increases | Speed matches `28 + random*18 + floor(score/30)*4` per tier | Verify |
| 14 | `showInterstitial()` called on life loss | AdManager interstitial invoked (with frequency cap) | Verify |
| 15 | `offerDoubleScore(score,'arrowdodge_best')` called on DEAD | Double-score prompt shown | Verify |

## Known Edge Cases

### Arrow-Target Collision on Same Frame
If an arrow and a target reach the same position in the same `update(dt)` call and the target simultaneously exits the bottom edge, both `onArrowHit` and `loseLife` could potentially be triggered. Verify only the hit path fires when the arrow intercepts before the bottom boundary is crossed.

### Wind Sign Flip at Tier Boundaries
Because wind is re-rolled at each 30-point threshold using `(random-0.5)`, the sign (left/right) can reverse unexpectedly mid-play. Verify the wind indicator updates immediately when this re-roll occurs.

### Zero `distToArcher` Guard
If the player taps exactly at `(archerX, archerY)`, `distToArcher` is 0 and the direction vector is undefined. Verify `fireArrow` guards against zero-length direction or clamps minimum distance.

### Cooldown Timer Underflow
If `dt` is very large (e.g., tab regains focus after suspension), `cooldown` could skip past 0 in a single frame. Verify `cooldown` is clamped to `>= 0` and does not allow negative values that could break comparison logic.

## Audio Test Matrix

| Event | Sound | Condition |
|---|---|---|
| Arrow fired | `'tap'` | Tap during PLAYING, cooldown elapsed |
| Life lost | `'crash'` | Target exits bottom |
| Target hit | `'gem'` | Arrow collides with target |
| Game over | `'lose'` | `lives` reaches 0 |

## Ad Integration Tests

| Call | Trigger | Verified By |
|---|---|---|
| `gameplayStart()` | `startGame()` | Check AdManager log on new run |
| `showInterstitial()` | Each `loseLife()` call | Frequency cap: max 1 per 3 runs / 60s gap |
| `gameplayStop()` | `lives <= 0` in `loseLife()` | Check AdManager log on death |
| `onRunEnd()` | `lives <= 0` in `loseLife()` | Check AdManager log on death |
| `offerDoubleScore(score,'arrowdodge_best')` | DEAD state entry | Double-score UI shown |
