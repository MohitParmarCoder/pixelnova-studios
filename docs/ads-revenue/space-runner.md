# Space Runner — Ads & Revenue Configuration

## Ad Integration Points

| Trigger | AdManager Call | Timing |
|---|---|---|
| Game session starts | `AdManager.gameplayStart()` | Inside `startGame()`, before first frame of PLAYING |
| Player dies (game over) | `AdManager.gameplayStop()` | First call on death, before score screen |
| Run ends | `AdManager.onRunEnd()` | Immediately after `gameplayStop()` |
| Interstitial ad | `AdManager.showInterstitial()` | After `onRunEnd()` — subject to frequency cap (1 per 3 runs, 60 s gap) |
| Double score offer | `AdManager.offerDoubleScore()` | After `showInterstitial()` — rewarded ad unit |

Call order on death must be: `gameplayStop()` → `onRunEnd()` → `showInterstitial()` → `offerDoubleScore()`.

## localStorage Best Score Key
| Key | Type | Description |
|---|---|---|
| `spacerunner_best` | string (integer) | Highest score achieved; read on init, written on death if score > best |

## CrazyGames SDK Mapping
| AdManager Method | CrazyGames SDK Call |
|---|---|
| `gameplayStart()` | `CrazyGames.SDK.game.gameplayStart()` |
| `gameplayStop()` | `CrazyGames.SDK.game.gameplayStop()` |
| `showInterstitial()` | `CrazyGames.SDK.ad.requestAd('interstitial', callbacks)` |
| `offerDoubleScore()` | `CrazyGames.SDK.ad.requestAd('rewarded', callbacks)` |
| `onRunEnd()` | Internal frequency-cap accounting only; no direct SDK call |

Switch `config.adapter` in `ads.js` from `'null'` to `'crazygames'` before portal submission.

## Revenue Optimization Notes
1. **Interstitial frequency cap**: AdManager enforces 1 interstitial per 3 runs with a 60 s minimum gap. Do not bypass this — CrazyGames penalizes over-serving.
2. **Rewarded double score**: `offerDoubleScore()` is the primary rewarded ad touchpoint. Ensure the DEAD screen clearly communicates the offer (e.g., "Watch an ad to double your score!") to maximize opt-in rate.
3. **Session length**: Average session for a wave-based shooter is 2–4 minutes. With the frequency cap, players will see roughly 1 interstitial per 3 sessions — keep interstitial placement at natural breakpoints (death screen) to minimize disruption.
4. **Best-score motivation**: Displaying `spacerunner_best` prominently on the DEAD screen encourages replays, increasing total ad impressions per user per day.
5. **Adapter swap**: The `ads.js` `config.adapter` field controls which SDK is active. Test with `'null'` adapter locally; swap to `'crazygames'` or `'gamedistribution'` only in the portal build.
