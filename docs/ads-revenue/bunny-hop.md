# Ads & Revenue Documentation: Bunny Hop

## Ad Integration Overview

Bunny Hop uses the shared `AdManager` interface (defined in `ads.js`). The active adapter is controlled by `config.adapter` at the top of `ads.js`. Default is `'null'` (no-op); switch to `'crazygames'` or `'gamedistribution'` before portal submission.

## Ad Call Map

| Location in code | Function called | Trigger |
|---|---|---|
| `tap()` — MENU → PLAYING transition | `gameplayStart()` | Player starts a new run |
| `die()` | `gameplayStop()` | Run ends (bunny falls off bottom) |
| `die()` | `onRunEnd()` | Signals completed game session to ad network |
| `die()` | `showInterstitial()` | Attempts to show interstitial ad |
| DEAD screen | `offerDoubleScore(score, 'bunnyhop_best')` | Prompts rewarded-ad double-score offer |

## Interstitial Frequency Cap

Enforced in `AdManager.showInterstitial()` (not in game code):
- Maximum 1 interstitial per 3 runs (`orbit_runs` counter, shared across all games using the same AdManager instance).
- Minimum 60-second gap between interstitials.

These limits apply to Bunny Hop automatically without game-specific configuration.

## Rewarded Ad: Double Score

`offerDoubleScore(score, 'bunnyhop_best')` is called on the DEAD screen. The AdManager presents a rewarded video offer. On completion:
- Final `score` is doubled.
- Doubled value is compared against `localStorage('bunnyhop_best')` and saved if it is a new best.

If the player declines or the ad fails to load, the original score is used unchanged.

## Revenue Touchpoints Per Session

A typical session generates:
1. One `gameplayStart` / `gameplayStop` pair (gameplay tracking).
2. One potential interstitial (subject to frequency cap).
3. One potential rewarded ad on DEAD screen.

Endless-runner sessions are typically short (30 s – 3 min), meaning interstitial frequency cap will rarely block an ad on the first few runs of a session. Expected interstitial fill rate is high compared to longer-session games.

## Adapter Configuration

Edit `ads.js` top of file:

```js
config.adapter = 'null';          // development / local testing
config.adapter = 'crazygames';    // CrazyGames portal
config.adapter = 'gamedistribution'; // GameDistribution portal
```

Each adapter implements `gameplayStart()`, `gameplayStop()`, `onRunEnd()`, `showInterstitial()`, and `offerDoubleScore()` against the respective portal SDK.

## Estimated Revenue Characteristics

| Metric | Notes |
|---|---|
| Session length | Short (< 3 min typical) — good for interstitial frequency |
| Replay rate | High — endless jumper loop encourages immediate retry |
| Rewarded ad uptake | Moderate — double-score offer is meaningful at high carrot runs |
| Ad density | 1 interstitial per ≥3 runs — not aggressive, portal-compliant |

## Portal Compliance Notes

- `gameplayStart()` and `gameplayStop()` must bracket every play session. Bunny Hop calls these correctly (start on first tap, stop in `die()`).
- CrazyGames and GameDistribution both require gameplay bracketing; current implementation satisfies this.
- The DEAD → MENU reset does not re-call `gameplayStart()` until the player taps to start a new run — correct behavior.
