# Asteroid Belt — Ads & Revenue Integration

## Overview
Asteroid Belt integrates with the shared `AdManager` module. The adapter (`'null'`, `'crazygames'`, `'gamedistribution'`) is configured via `config.adapter` in `ads.js`. All ad calls originate from `game.js`; no SDK is called directly.

## Ad Call Map

| Call | Location in game.js | Timing |
|---|---|---|
| `AdManager.gameplayStart()` | `startGame()` | At the start of every new run |
| `AdManager.showInterstitial()` | `loseLife()` | On every life loss (frequency-capped by AdManager) |
| `AdManager.gameplayStop()` | `loseLife()` when `lives <= 0` | When the run ends |
| `AdManager.onRunEnd()` | `loseLife()` when `lives <= 0` | After `gameplayStop()`, signals SDK |
| `AdManager.offerDoubleScore(score, 'asteroidbelt_best')` | DEAD state | Rewarded-ad prompt to double the crystal score |

## Interstitial Frequency Cap
Capping is handled by `AdManager.showInterstitial()`:
- Maximum 1 interstitial per 3 runs.
- Minimum 60-second gap between interstitials.

With 3 lives per run, up to 3 interstitial attempts occur per run; the cap ensures at most one fires. On short runs where all 3 lives are lost quickly, the gap cap is the binding constraint.

## Rewarded Ad: Double Score
`offerDoubleScore(score, 'asteroidbelt_best')` is called at DEAD. Expected flow:
1. Player sees "Watch ad to double your crystal count?" prompt.
2. If accepted and ad completed, `score` is doubled and compared to `localStorage.getItem('asteroidbelt_best')`.
3. If declined, original `score` is used for best-score comparison.

Asteroid Belt's score (crystal count) grows relatively slowly — typical runs may score 5–20 crystals — making the doubling offer high-value and likely to convert.

## localStorage Integration
- Key: `'asteroidbelt_best'`
- Compared and updated after the double-score flow resolves.

## Adapter Swap Instructions

### CrazyGames
```js
config.adapter = 'crazygames';
```
Add CrazyGames SDK `<script>` before `ads.js` in `index.html`.

### GameDistribution
```js
config.adapter = 'gamedistribution';
```
Add GD SDK `<script>` before `ads.js` in `index.html`.

### Null (development)
```js
config.adapter = 'null';
```
All ad calls are no-ops; game runs without interruption.

## Revenue Considerations
- **Session structure:** Asteroid Belt's continuous drag-to-dodge mechanic creates longer session windows than tap-only games. Players may survive multiple minutes on a single life.
- **Interstitial placement:** Life-loss interstitials are natural pause points (ship destroyed, brief respite before next attempt). Placement is appropriate; avoid moving interstitials to crystal-collect events, which would severely disrupt flow.
- **Rewarded ad value:** Because score is raw crystal count (integers), doubling a score of 12 to 24 is meaningful relative to the best-score leaderboard. Conversion rate should be strong.
- **Difficulty curve and session length:** The smooth `tick`-based difficulty scaling means sessions get dramatically harder after ~44 seconds (spawn interval at minimum). Average session length may be short on first sessions, limiting ad impressions. Consider a gentler early slope.
