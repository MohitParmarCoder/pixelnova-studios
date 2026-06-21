# Ad Integration Guide — PixelNova Studios

## Architecture Overview

All 100 games + Orbit Hopper use a unified `AdManager` module (`js/ads.js`) with a pluggable adapter pattern. Switch platforms by changing one line.

---

## Adapter Configuration

In every game's `js/ads.js`, change the adapter at the top:

```js
var config = {
  adapter: 'null'          // Options: 'null' | 'crazygames' | 'gamedistribution'
};
```

| Adapter | When to use |
|---------|-------------|
| `'null'` | Local development, testing — no ads fire |
| `'crazygames'` | Publishing to CrazyGames portal |
| `'gamedistribution'` | Publishing to GameDistribution |

---

## CrazyGames SDK v3 Integration

### Step 1 — Set adapter
```js
// In js/ads.js
var config = { adapter: 'crazygames' };
```

### Step 2 — Add SDK script to index.html
```html
<!-- Add BEFORE all game scripts -->
<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>
```

### Step 3 — SDK method mapping

| AdManager call | CrazyGames SDK v3 call |
|---------------|------------------------|
| `AdManager.gameplayStart()` | `window.CrazyGames.SDK.game.gameplayStart()` |
| `AdManager.gameplayStop()` | `window.CrazyGames.SDK.game.gameplayStop()` |
| `AdManager.showInterstitial(cb)` | `window.CrazyGames.SDK.ad.requestAd('midgame', { adFinished: cb, adError: cb })` |
| `AdManager.offerDoubleScore(score, key)` | `window.CrazyGames.SDK.ad.requestAd('rewarded', { adFinished: () => doubleAndSave(score, key) })` |

### Step 4 — Verify in browser
Open DevTools Console. You should see no errors from CrazyGames SDK. Gameplay events should appear in the CrazyGames portal analytics after submission.

---

## GameDistribution SDK v4 Integration

### Step 1 — Set adapter
```js
var config = { adapter: 'gamedistribution' };
```

### Step 2 — Add SDK to index.html
```html
<script src="https://html5.api.gamedistribution.com/main.min.js"></script>
```

### Step 3 — Configure App ID
In `js/ads.js`, set the `appId` in the GD adapter init block to your game's App ID from the GD portal.

### SDK method mapping

| AdManager call | GD SDK v4 call |
|---------------|----------------|
| `AdManager.gameplayStart()` | `gdsdk.showAd(gdsdk.AdType.Interstitial)` (before gameplay) |
| `AdManager.showInterstitial(cb)` | `gdsdk.showAd(gdsdk.AdType.Interstitial).then(cb)` |
| `AdManager.offerDoubleScore(...)` | `gdsdk.showAd(gdsdk.AdType.Rewarded).then(...)` |

---

## Interstitial Frequency Cap

Enforced globally in `AdManager`, not in individual adapters:

```js
// In ads.js — these limits apply regardless of adapter
var MIN_RUNS_BETWEEN_ADS = 3;    // Show at most every 3 runs
var MIN_TIME_BETWEEN_ADS = 60;   // Show at most every 60 seconds
```

This prevents excessive ad interruption and maintains CrazyGames / GD compliance.

---

## Rewarded Ad (Double Score)

Called when the player dies:
```js
AdManager.offerDoubleScore(score, 'gamename_best');
```

This creates a DOM overlay button "Watch Ad — Double Score". When clicked:
1. Fires rewarded ad via the active adapter
2. On completion: doubles `score`, saves to `localStorage[key]` if it's a new best
3. The overlay self-removes

**Revenue note:** Rewarded ads typically pay 3–10× CPM compared to interstitials. Maximize opt-in rate by positioning the offer prominently and immediately after death.

---

## Revenue Optimization

### Session Length Impact
Longer sessions → more interstitial ad opportunities. Games with combo systems and difficulty progression retain players longer.

| Game Type | Avg Session | Interstitials/session |
|-----------|------------|----------------------|
| Quick reflex (flash-tap, speed-click) | 1–3 min | 0–1 |
| Puzzle (memory-flip, dot-link) | 3–8 min | 1–2 |
| Endless runner/arcade | 2–5 min | 1–2 |
| Strategy (number-merge, tetro-drop) | 5–15 min | 2–4 |

### CPM Benchmarks (HTML5 mobile games, 2025)
| Platform | CPM Range |
|----------|-----------|
| CrazyGames | $1.50–$4.00 |
| GameDistribution | $0.80–$2.50 |
| Rewarded ads (both) | $5.00–$15.00 |

### Maximizing Revenue
1. Prioritize rewarded ads — offer double score prominently after every death
2. Don't cap interstitials too aggressively — 1 per 3 runs is the current minimum
3. Submit games with higher session lengths to CrazyGames first
4. Use CrazyGames "Featured Game" submissions for higher traffic slots

---

## Testing Ad Integration

```bash
# Serve game locally
python3 -m http.server 8889 --directory games/arrow-dodge

# Open browser console
# Check for: "AdManager: gameplayStart" log (null adapter logs calls)
# Change to 'crazygames' adapter and load CrazyGames SDK to test real calls
```

With `adapter: 'null'`, all AdManager calls log to console and no SDK is required — safe for local dev.

---

## Per-Game Ad Key Reference

Each game uses a unique localStorage key for the double score offer. See individual game docs in `docs/ads-revenue/{game-name}.md` for the exact key.

Pattern: `{gamename}_best` (e.g., `arrowdodge_best`, `wordblitz_best`, `zombiesmash_best`).
