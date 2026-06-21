# Bounce Master — Ads & Revenue Reference

## Ad Integration Summary

Bounce Master integrates with the shared AdManager module. The adapter is selected via `config.adapter` at the AdManager level (`'null'`, `'crazygames'`, or `'gamedistribution'`). No ad logic lives inside the game file itself.

## Ad Call Locations

### `gameplayStart()`
- **Where**: Inside `startGame()`, called when transitioning from MENU → PLAYING.
- **Purpose**: Notifies the ad network that a gameplay session has begun (used for session tracking and mid-session ad suppression).

### `gameplayStop()`
- **Where**: Inside `update()`, triggered when `lives <= 0`.
- **Purpose**: Signals the end of the gameplay session to the ad network.

### `onRunEnd()`
- **Where**: Immediately after `gameplayStop()`, same `lives <= 0` branch.
- **Purpose**: Increments the run counter used for interstitial frequency capping (1 per 3 runs, 60 s gap enforced in AdManager).

### `showInterstitial()`
- **Where**: Same `lives <= 0` branch, called after `onRunEnd()`.
- **Purpose**: Attempts to show a full-screen interstitial ad. AdManager enforces the frequency cap — the call may be a no-op if the cap is not met.

### `offerDoubleScore(score, 'bouncemaster_best')`
- **Where**: DEAD screen rendering / interaction.
- **Purpose**: Presents a rewarded video offer. If the player watches an ad, their score is doubled before being compared to `'bouncemaster_best'` in localStorage.

## Frequency & Pacing

| Ad Type | Frequency | Enforced By |
|---|---|---|
| Interstitial | Max 1 per 3 runs, min 60 s gap | AdManager |
| Rewarded video | Once per death, opt-in | Game (DEAD screen) |

## Revenue Considerations

### Session Length
- Average session: 2–5 minutes (3 lives × ~60–90 s per round).
- Interstitials fire at most once per 3 runs (~6–15 min), which is conservative for a casual game.
- Recommendation: reduce cap to 1 per 2 runs for higher eCPM yield if retention data supports it.

### Rewarded Video Placement
- `offerDoubleScore` is well-placed on the DEAD screen — high emotional moment, player motivated to improve their score.
- Ensure the doubled score is only applied to the `'bouncemaster_best'` comparison, not displayed as the "real" score, to maintain fairness.

### Portal-Specific Notes

| Portal | Adapter | Notes |
|---|---|---|
| CrazyGames | `'crazygames'` | Requires `CrazyGames.SDK.gameplayStart/Stop()` |
| GameDistribution | `'gamedistribution'` | Requires `gdsdk.showAd()` |
| Standalone / Test | `'null'` | All ad calls are no-ops |

## localStorage Key

| Key | Value |
|---|---|
| `'bouncemaster_best'` | Player's all-time high score (integer) |

Used by `offerDoubleScore` to determine if the doubled score is a new best.
