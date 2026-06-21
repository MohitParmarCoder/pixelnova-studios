# Block Drop — Ads & Revenue

## Ad Integration Points

| Event | Function(s) | Call Site | Notes |
|---|---|---|---|
| Session start | `gameplayStart()` | `startGame()` | Called once per run before first piece spawns; signals to SDK that gameplay has begun |
| Session end | `gameplayStop()` + `onRunEnd()` + `showInterstitial()` | `endGame()` | All three called in sequence on death; interstitial fires on every run end |
| Double score offer | `offerDoubleScore(score, 'blockdrop_best')` | `endGame()`, after interstitial | Rewarded ad offer; if accepted, score is doubled before best-score comparison |

## localStorage

| Key | Type | Content |
|---|---|---|
| `blockdrop_best` | string (integer) | Highest score achieved across all runs; read at `init()`, written in `endGame()` after optional double-score resolution |

The best score key is passed as the second argument to `offerDoubleScore()` so the rewarded-ad callback can write the doubled value to the correct key.

## CrazyGames SDK Mapping

| SDK Call | Block Drop Usage |
|---|---|
| `CrazyGames.SDK.game.gameplayStart()` | Maps to `gameplayStart()` in `startGame()` |
| `CrazyGames.SDK.game.gameplayStop()` | Maps to `gameplayStop()` in `endGame()` |
| `CrazyGames.SDK.ad.requestAd('midgame', callbacks)` | Maps to `showInterstitial()` in `endGame()` |
| `CrazyGames.SDK.ad.requestAd('rewarded', callbacks)` | Maps to `offerDoubleScore()` rewarded flow |

Switch `config.adapter` from `'null'` to `'crazygames'` in `ads.js` to activate live SDK calls. The `'null'` adapter is a no-op stub safe for local development.

## Revenue Notes

**Interstitial frequency:** Unlike Orbit Hopper (which caps interstitials at 1 per 3 runs with a 60 s gap), Block Drop calls `showInterstitial()` on every death. Depending on the AdManager implementation, the frequency cap may still be enforced inside `AdManager.showInterstitial`. Verify that the cap logic in `AdManager` is appropriate for Block Drop's typical run length to avoid over-serving ads and degrading retention.

**Rewarded ad for double score:** The `offerDoubleScore` call on every game-over screen is a strong rewarded-ad placement. Players are most motivated to watch an ad immediately after a personal-best run. Ensure the offer UI only appears when it is meaningful (e.g., score > 0) to avoid rewarded-ad fatigue on very short runs.

**Level-based ad pacing consideration:** Because difficulty ramps continuously and run lengths vary widely, longer high-level runs generate only one interstitial per death. For monetization purposes, consider adding a mid-run interstitial trigger at milestone levels (e.g., every 10 levels) during natural pause moments, balanced against CrazyGames quality guidelines that require gameplay to be stopped before showing ads.

**GameDistribution:** The same `gameplayStart`/`gameplayStop`/`showInterstitial` call sites apply. Swap `config.adapter` to `'gamedistribution'` in `ads.js`. Rewarded ads on GD use a different SDK method; verify `offerDoubleScore` resolves correctly with the GD adapter.
