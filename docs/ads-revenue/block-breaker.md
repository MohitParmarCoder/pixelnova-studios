# Block Breaker — Ads & Revenue

## Ad Integration Points

| Event | Function(s) | Call Site | Notes |
|---|---|---|---|
| Session start | `gameplayStart()` | `tap()` — on MENU → PLAYING transition | Called once per new game session; must not fire on DEAD → MENU or WIN → PLAYING transitions |
| Session end | `gameplayStop()`, `onRunEnd()`, `showInterstitial()` | `_die()` — when `_lives` reaches 0 | All three called in sequence; `showInterstitial` is subject to adapter frequency cap |
| Double score offer | `offerDoubleScore(getScore(), 'blockbreaker_best')` | `_die()` — after session-end calls | Rewarded-ad flow; second argument is the leaderboard key used to compare against best |

Sequence on game over:
```
_die()
  └─ gameplayStop()        // signals SDK gameplay has ended
  └─ onRunEnd()            // updates run count / session metadata
  └─ showInterstitial()    // shows interstitial if frequency cap allows
  └─ offerDoubleScore(     // presents rewarded ad for 2× score
       getScore(),
       'blockbreaker_best'
     )
```

## localStorage Key

| Key | Type | Content |
|---|---|---|
| `blockbreaker_best` | String (integer) | All-time high score. Read by `getBest()`. Updated after `offerDoubleScore` resolves (either base score or doubled score, whichever applies). |

## CrazyGames SDK Mapping

| Block Breaker call | CrazyGames SDK equivalent | Notes |
|---|---|---|
| `gameplayStart()` | `CrazyGames.SDK.game.gameplayStart()` | Required by CrazyGames TOS whenever gameplay begins |
| `gameplayStop()` | `CrazyGames.SDK.game.gameplayStop()` | Required before any ad is shown |
| `showInterstitial()` | `CrazyGames.SDK.ad.requestAd('midgame', callbacks)` | AdManager handles the adapter-level call; set `config.adapter = 'crazygames'` |
| `offerDoubleScore()` | `CrazyGames.SDK.ad.requestAd('rewarded', callbacks)` | Rewarded flow: grant 2× score in `adFinished` callback; skip silently in `adError` |
| Banner (not currently wired) | `CrazyGames.SDK.ad.requestBanner(elementId, sizes)` | Consider adding a banner slot on the MENU state for passive revenue |

To activate the CrazyGames adapter: locate `config.adapter` at the top of the AdManager module and set it to `'crazygames'`. The game code itself requires no changes — all ad calls route through AdManager.

## Revenue Notes

**Interstitial frequency**: The AdManager enforces a platform-level frequency cap (typically 1 interstitial per 3 runs with a 60-second minimum gap, consistent with the Orbit Hopper implementation in this project). Block Breaker triggers one potential interstitial per run via `_die()`. At average session lengths of 2–4 minutes, this yields roughly 1 interstitial per 6–12 minutes of play — within CrazyGames recommended thresholds.

**Rewarded double-score**: `offerDoubleScore` is called unconditionally on every game over. This presents the rewarded ad opportunity to every player who dies, maximizing impression volume. Players who decline or whose device serves no fill incur no penalty — the base score is kept. Ensure the reward callback (`adFinished`) doubles `_score` before updating `blockbreaker_best` in localStorage.

**Revenue optimization opportunities**:
- Add a banner ad slot to the MENU state (passive revenue between runs, no gameplay interruption).
- Consider a second rewarded slot — "continue from current level with 1 extra life" — which would increase engagement and rewarded fill rate without breaking the interstitial cap.
- Track `_level` reached in `onRunEnd()` metadata to enable level-segmented eCPM analysis.
