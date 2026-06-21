# Arrow Dodge — Ads & Revenue Integration

## Overview
Arrow Dodge integrates with the shared `AdManager` module, which supports a swappable adapter (`'null'`, `'crazygames'`, `'gamedistribution'`) configured via `config.adapter` at the top of `ads.js`. All ad calls in the game delegate to `AdManager`; no ad SDK is called directly from `game.js`.

## Ad Call Map

| Call | Location in game.js | Timing |
|---|---|---|
| `AdManager.gameplayStart()` | `startGame()` | Immediately when a new run begins |
| `AdManager.showInterstitial()` | `loseLife()` | On every life loss (frequency-capped by AdManager) |
| `AdManager.gameplayStop()` | `loseLife()` when `lives <= 0` | When the run ends (all lives exhausted) |
| `AdManager.onRunEnd()` | `loseLife()` when `lives <= 0` | After `gameplayStop()`, signals run completion to SDK |
| `AdManager.offerDoubleScore(score, 'arrowdodge_best')` | DEAD state | Rewarded-ad prompt; player watches ad to double their score |

## Interstitial Frequency Cap
Frequency capping is enforced inside `AdManager.showInterstitial()`, not in `arrow-dodge` game code:
- Maximum 1 interstitial per 3 runs.
- Minimum 60-second gap between interstitials.

Because `showInterstitial()` is called on every `loseLife()` (not just on death), a 3-life run can trigger up to 3 interstitial attempts per run; AdManager's cap ensures only one fires at most.

## Rewarded Ad: Double Score
`offerDoubleScore(score, 'arrowdodge_best')` is called at end-of-run. The expected behavior:
1. Player is shown a "Watch ad to double score?" prompt.
2. If the player accepts and completes the ad, `score` is doubled and compared against `localStorage.getItem('arrowdodge_best')`.
3. If the player declines, the original `score` is used for the best-score comparison.

## localStorage Integration
- Key: `'arrowdodge_best'`
- Updated after the double-score flow resolves so that a rewarded ad can produce a new best score.

## Adapter Swap Instructions

### CrazyGames
```js
// ads.js top
config.adapter = 'crazygames';
```
Ensure the CrazyGames SDK script tag is present in `index.html` before `ads.js`.

### GameDistribution
```js
config.adapter = 'gamedistribution';
```
Ensure the GD SDK script tag is present in `index.html` before `ads.js`.

### Null (development / no ads)
```js
config.adapter = 'null';
```
All `AdManager` calls become no-ops; game runs without any ad interruptions.

## Revenue Considerations
- **Session length:** Arrow Dodge runs are short (3 lives, increasingly fast targets). Average session likely 1–3 minutes. Rewarded ads are the primary revenue lever.
- **Interstitial timing:** Life-loss interstitials are well-placed (natural pause), but the frequency cap must be tuned to avoid disrupting flow on early lives. Consider raising the cap threshold to "on death only" for improved retention on portal platforms.
- **Double-score offer:** High conversion expected — scores grow slowly, so doubling is meaningful. Ensure the offer clearly communicates the value before the ad plays.
