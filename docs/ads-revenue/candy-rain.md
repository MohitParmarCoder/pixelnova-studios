# Candy Rain — Ads & Revenue Guide

## Overview
- **Game:** Candy Rain
- **Namespace:** `CandyRain`
- **Genre:** Number Matching
- **Estimated session length:** 60s–2min
- **localStorage best-score key:** `candyrain_best`

## Ad Integration Architecture

Candy Rain uses the shared `AdManager` module (`js/ads.js`). The adapter is selected via `config.adapter` at the top of `ads.js`.

| Adapter | Use case |
|---|---|
| `'null'` | Local dev / testing — no actual ads |
| `'crazygames'` | CrazyGames portal deployment |
| `'gamedistribution'` | GameDistribution portal deployment |

## Ad Events in `game.js`

| Game Event | AdManager Call |
|---|---|
| Player starts a run | `AdManager.gameplayStart()` |
| Player dies / game over | `AdManager.gameplayStop()` |
| After run recorded | `AdManager.onRunEnd()` |
| Between runs (DEAD screen) | `AdManager.showInterstitial(callback)` |
| DEAD screen offer | `AdManager.offerDoubleScore(score, 'candyrain_best')` |

## Interstitial Frequency Cap
The `AdManager` module enforces a frequency cap globally:
- Maximum 1 interstitial per 3 runs
- Minimum 60-second gap between interstitials

This cap is enforced in `AdManager.showInterstitial()` — no per-game configuration needed.

## Rewarded Ad — Double Score Offer
When `offerDoubleScore(score, 'candyrain_best')` is called:
1. A DOM overlay renders: "Watch Ad — Double Your Score?"
2. Player taps "Watch Ad" → rewarded ad plays
3. On ad completion: `score × 2` is saved to `localStorage['candyrain_best']`
4. DOM overlay removed

This offer appears on every DEAD screen but rewarded ad only plays if player opts in.

## Revenue Optimization Tips

### Session Length
Estimated session: 60s–2min. For games under 2 minutes, interstitials every 3 runs is appropriate. For longer games, consider every 2 runs.

### Rewarded Ad Placement
Double score offer is well-placed — it triggers when player emotionally invested in their score. Conversion rates tend to be higher for players with scores above their previous best.

### Portal Selection Priority
1. **CrazyGames** — highest CPM rates, good for arcade games, strict quality bar
2. **GameDistribution** — wider reach, more lenient quality requirements
3. **Poki** — requires exclusive licensing negotiation
4. **Itch.io** — donation model, less ad revenue but good for portfolio

## CrazyGames-Specific Configuration
```javascript
// In js/ads.js — top of file
var config = {
  adapter: 'crazygames',  // ← set this
  gameId: 'YOUR_GAME_ID_HERE'
};
```

Add before `ads.js` in `index.html`:
```html
<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>
```

## GameDistribution-Specific Configuration
```javascript
var config = {
  adapter: 'gamedistribution',
  gameId: 'YOUR_GD_GAME_ID_HERE'
};
```

Add before `ads.js` in `index.html`:
```html
<script src="https://html5.api.gamedistribution.com/main.min.js"></script>
```

## Revenue Projections (Estimates)

| Portal | Daily Active Users | Est. RPM | Est. Daily Revenue |
|---|---|---|---|
| CrazyGames | 500–2000 | $1–3 | $0.50–6.00 |
| GameDistribution | 300–1500 | $0.50–1.50 | $0.15–2.25 |

*These are rough estimates. Actual numbers depend on traffic, region, and game quality rating.*
