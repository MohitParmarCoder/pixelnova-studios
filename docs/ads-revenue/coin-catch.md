# Coin Catch — Ads & Revenue Guide

## Overview
- **Game:** Coin Catch
- **Namespace:** `CoinCatch`
- **Genre:** Catch Arcade
- **Estimated session length:** 60s–3min
- **localStorage best-score key:** `coincatch_best`

## Ad Integration Architecture
Coin Catch uses the shared `AdManager` module (`js/ads.js`). Set `config.adapter` at top of `ads.js`.

| Adapter | Use case |
|---|---|
| `'null'` | Local dev / testing |
| `'crazygames'` | CrazyGames portal |
| `'gamedistribution'` | GameDistribution portal |

## Ad Events in `game.js`

| Game Event | AdManager Call |
|---|---|
| Run starts | `AdManager.gameplayStart()` |
| Player dies | `AdManager.gameplayStop()` |
| After run | `AdManager.onRunEnd()` |
| Between runs | `AdManager.showInterstitial(callback)` |
| DEAD screen | `AdManager.offerDoubleScore(score, 'coincatch_best')` |

## Interstitial Frequency Cap
Maximum 1 interstitial per 3 runs, 60-second gap minimum — enforced in `AdManager.showInterstitial()`.

## Revenue Optimization
- Session ~60s–3min: interstitial every 3 runs is appropriate frequency
- Rewarded double-score offer activates after every death — high conversion opportunity
- Grace period mechanic (coin appears, brief safe window before penalty) keeps sessions going longer

## CrazyGames-Specific Configuration
```javascript
var config = { adapter: 'crazygames', gameId: 'YOUR_GAME_ID_HERE' };
```
Add SDK before `ads.js`: `<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>`

## GameDistribution-Specific Configuration  
```javascript
var config = { adapter: 'gamedistribution', gameId: 'YOUR_GD_GAME_ID_HERE' };
```
