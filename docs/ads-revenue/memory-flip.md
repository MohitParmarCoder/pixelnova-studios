# Memory Flip — Ads & Revenue Configuration

## Ad Integration Points
- `AdManager.gameplayStart()` — called in `startGame()` when gameplay begins, and again when advancing to the next level inside the WIN-state `update()` branch (`winTimer <= 0` block)
- `AdManager.gameplayStop()` — called in `runEnded()`, which is triggered by `gameOver()` (time-up only; level wins do not call this)
- `AdManager.onRunEnd()` — called in `runEnded()` immediately after `gameplayStop()`
- `AdManager.showInterstitial(cb)` — called twice:
  1. In `runEnded()` with an empty no-op callback `function () {}`
  2. In `tap()` when DEAD state is tapped, with `startGame` as the callback (so the ad resolves before restarting)
- `AdManager.offerDoubleScore(score, 'memflip_best')` — called in `runEnded()` with the current `score` value and the localStorage key `'memflip_best'`

## localStorage Best Score Key
- Key: `'memflip_best'`
- Used as the second argument to `AdManager.offerDoubleScore(getScore(), 'memflip_best')`
- Best score is managed externally (by the harness/main.js); `MemoryFlip` only receives it via `init(canvas, best)` and updates `_best` in memory

## CrazyGames SDK Mapping
- `sdk.game.gameplayStart()` → maps from `AdManager.gameplayStart()` (fires at `startGame()` and on each level advance)
- `sdk.game.gameplayStop()` → maps from `AdManager.gameplayStop()` (fires only at `gameOver()`, not between levels)
- Interstitial frequency: 1 per 3 runs, 60 s minimum gap — enforced inside `ads.js`, not in `game.js`
- Note: `gameplayStart()` is called on every level advance, which will re-fire `sdk.game.gameplayStart()` on the CrazyGames adapter. This is correct SDK usage — it signals the start of a new uninterrupted gameplay segment.

## Revenue Optimization Notes
- **Session length estimate:** 1–5 minutes per run. Level 1 is 60 s; subsequent levels are 55 s, 50 s, 45 s. Skilled players clearing 3–4 levels will play 3–4 minutes per run, placing this in the mid-session category.
- **Rewarded ad opportunity:** `offerDoubleScore` is called at game-over; a rewarded video to double the score gives a clear, meaningful incentive since score accumulates across levels and players feel invested after multi-level runs.
- **Ad fill rate considerations:** Interstitials fire only at game-over (not between levels), so ad load is low — one interstitial per run. This conservative placement is appropriate for a puzzle game where mid-level ads would be highly disruptive. Consider adding a rewarded "refill timer" option (e.g., watch an ad to get 15 extra seconds) as a second ad unit that does not disrupt flow.
- **Between-level ad gap:** No interstitial between levels — this is intentional to maintain game flow but means only one ad impression per full run regardless of how many levels are completed.
