# Card-Pairs (Blackjack 21) — Ads & Revenue

## Ad Integration Summary

Card-Pairs uses the shared `AdManager` module with the same adapter system as other games in the suite (`'null'` / `'crazygames'` / `'gamedistribution'`).

## Ad Call Map

| Ad Call | Location in Code | Trigger Condition |
|---|---|---|
| `gameplayStart()` | `startGame()` | Every new game session begins |
| `gameplayStop()` | `endGame()` | Player reaches DEAD state |
| `onRunEnd()` | `endGame()` | Player reaches DEAD state (same call site as above) |
| `showInterstitial()` | `tap()` — DEAD branch | Player taps to continue after game over |
| `offerDoubleScore(chips, 'cardpairs_best')` | `tap()` — DEAD branch | Player taps to continue; rewarded ad offer |

## Interstitial Frequency

Interstitial display is governed by `AdManager.showInterstitial()` which enforces:
- Maximum 1 interstitial per 3 runs.
- Minimum 60-second gap between interstitials.

These limits are enforced inside `AdManager`, not in Card-Pairs game code.

## Rewarded Ad: Double Score

`offerDoubleScore(chips, 'cardpairs_best')` presents the player with an option to watch a rewarded ad in exchange for doubling their chip count before the score is committed to `cardpairs_best`.

- The offer triggers immediately after `showInterstitial()` on game over.
- If accepted, `chips` is doubled, which may push it above the previous best and update `cardpairs_best`.
- This is the primary rewarded ad monetisation surface.

## Revenue Considerations

### Strengths
- Round-based play (fast ~10–30 second rounds) leads to frequent game-over events, increasing interstitial opportunities.
- `offerDoubleScore` is well-placed at high-emotion moment (just lost).
- Fixed BET of 10 chips means deterministic game lengths — predictable session duration for ad pacing.

### Weaknesses
- Only one rewarded ad surface (`offerDoubleScore`). Consider adding a mid-session rewarded ad (e.g., "Watch an ad to regain a life").
- No rewarded ad for starting bonus chips.
- Players who reach 200 chips (win state) do not trigger `showInterstitial` or `offerDoubleScore` — a win path has no ad monetisation.

## Adapter Configuration

Set `config.adapter` in `ads.js`:

| Value | Behaviour |
|---|---|
| `'null'` | No ads shown (development/default) |
| `'crazygames'` | CrazyGames SDK integration |
| `'gamedistribution'` | GameDistribution SDK integration |

## Recommended Revenue Improvements

1. Add `showInterstitial()` on win condition (chips >= 200) — high-engagement moment.
2. Add a rewarded ad to restore one life ("Continue with a life? Watch ad").
3. Consider a "bonus chips" rewarded ad from the MENU screen (e.g., "Start with 150 chips — watch an ad").
4. Track `onRunEnd()` metrics to measure average session length and tune interstitial frequency accordingly.
