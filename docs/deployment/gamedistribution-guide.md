# GameDistribution Deployment Guide — PixelNova Studios

## Overview

GameDistribution (GD) is a secondary distribution platform with 350M+ monthly players. Approval is faster than CrazyGames, making it a good parallel submission target. CPM is typically lower ($0.80–$2.50 vs CrazyGames's $1.50–$4.00), but volume compensates.

---

## Key Differences from CrazyGames

| Factor | CrazyGames | GameDistribution |
|--------|-----------|-----------------|
| Monthly players | 35M | 350M |
| CPM | Higher | Lower |
| Approval time | 3–7 days | 1–3 days |
| Quality bar | Higher | Moderate |
| SDK version | v3 | v4 |
| Preloader restriction | Strict | Flexible |
| Category importance | Critical | Important |

---

## SDK Integration

### Step 1 — Set adapter
```js
// In js/ads.js
var config = { adapter: 'gamedistribution' };
```

### Step 2 — Add GD SDK to index.html
```html
<!-- Add BEFORE all other scripts -->
<script>
  window.GD_OPTIONS = {
    "gameId": "YOUR_GAME_ID_HERE",  // Get from GD portal
    "onEvent": function(event) {
      switch (event.name) {
        case "SDK_READY": console.log("GD SDK Ready"); break;
        case "SDK_ERROR": console.error("GD SDK Error"); break;
        case "AD_START": break;
        case "AD_FINISH": break;
      }
    }
  };
</script>
<script src="https://html5.api.gamedistribution.com/main.min.js"></script>
```

### Step 3 — Configure App ID in ads.js
In the GD adapter section of `js/ads.js`, replace the placeholder:
```js
// gamedistribution adapter
var GD_GAME_ID = 'YOUR_GAME_ID_HERE';
```

Get the Game ID from the GD developer portal after creating a game entry.

---

## Ad Method Mapping

| AdManager call | GD SDK v4 equivalent |
|---------------|---------------------|
| `AdManager.gameplayStart()` | `gdsdk.gameSDK.gameplayStart()` |
| `AdManager.gameplayStop()` | `gdsdk.gameSDK.gameplayStop()` |
| `AdManager.showInterstitial(cb)` | `gdsdk.showAd(gdsdk.AdType.Interstitial).then(cb)` |
| `AdManager.offerDoubleScore(s, k)` | `gdsdk.showAd(gdsdk.AdType.Rewarded).then(() => doubleAndSave(s, k))` |

---

## Technical Requirements

- [ ] Game loads without preloader (MENU state on init)
- [ ] Works on desktop and mobile
- [ ] No external dependencies
- [ ] HTTPS-compatible
- [ ] Game ID configured in SDK options
- [ ] `gameplayStart()` and `gameplayStop()` called correctly

---

## Submission Process

### 1. Create account
Register at developer.gamedistribution.com

### 2. Add game entry
- Click "Add Game"
- Fill in title, description, category, tags
- Get your Game ID from the entry

### 3. Prepare files
```bash
# Set GD adapter
# Edit js/ads.js: config.adapter = 'gamedistribution'
# Add Game ID to SDK options in index.html
# Add GD SDK script to index.html

# Zip
zip -r game-name.zip game-name/
```

### 4. Upload
Upload the zip. GD supports direct file upload or URL hosting.

### 5. Set metadata
- Category
- Age rating (most of our games: Everyone)
- Language: English
- Orientation: Portrait

---

## Category Guide (GD)

| GD Category | Our Games |
|-------------|-----------|
| Arcade | arrow-dodge, asteroid-belt, cave-runner, dino-dash, endless-runner, fireball-run, zombie-smash, etc. |
| Casual | candy-rain, coin-catch, egg-drop, fruit-catcher, potion-grab, snowball-catch |
| Puzzle | block-blast, color-flood, dot-link, hex-flip, laser-maze, match-gems, pipe-rush, tetro-drop, water-flow |
| Sports | basket-shot, billiard-aim, bowling-strike, golf-lite, pool-shots |
| Action | bomb-squad, flash-tap, missile-evade, star-blaster, target-blitz |
| Memory | card-pairs, color-memory, memory-flip, pattern-repeat, sequence-game |
| Strategy | number-merge, gravity-maze, shadow-slide |
| Music | rhythm-tap |

---

## Revenue Notes

- GD pays out monthly, minimum threshold $100
- Rewarded ads pay significantly more than interstitials — prioritize the double-score offer
- GD has a network of 1,500+ partner sites — traffic can vary significantly
- Connect Google Analytics or GD's built-in analytics for tracking

---

## Parallel Submission Strategy

Submit to CrazyGames and GD simultaneously. They are not exclusive. CrazyGames typically drives more focused gaming traffic; GD drives higher volume of casual players.

**Recommended workflow:**
1. Prepare game for CrazyGames (set CrazyGames adapter, add their SDK)
2. Create a separate build copy with GD adapter + GD SDK
3. Submit both at once — approval timelines don't conflict
4. Monitor both dashboards for revenue and player feedback
