# Orbit Hopper — Deployment Guide

## Overview
Orbit Hopper is the PixelNova Studios flagship HTML5 canvas arcade game. Zero build step, zero npm dependencies. One-touch gameplay with procedural audio, power-ups, and gameplay music.

## File Structure
```
orbit-hopper/
  index.html        # entry point
  js/
    audio.js        # Audio module: ZzFX + ambient drone + gameplay music sequencer
    ads.js          # AdManager: null / crazygames / gamedistribution
    input.js        # Unified pointer/keyboard input
    ui.js           # Canvas icon drawing primitives
    game.js         # Game logic (~1700+ lines)
    main.js         # Bootstrap + rAF loop
  smoke-test.js     # Headless smoke test
  test/e2e.js       # Playwright E2E tests
  promo.html        # 512×512 and 1280×720 cover art
  README.md         # Full game documentation
```

## Script Load Order
```html
<script src="js/audio.js"></script>
<script src="js/ads.js"></script>
<script src="js/input.js"></script>
<script src="js/ui.js"></script>
<script src="js/game.js"></script>
<script src="js/main.js"></script>
```

## Local Development
```bash
python3 -m http.server 8080 --directory orbit-hopper
# Open http://localhost:8080

node --check orbit-hopper/js/game.js    # syntax check
node orbit-hopper/smoke-test.js          # headless runtime test
```

## Ad Adapter Configuration
Open `js/ads.js` and set `config.adapter`:

| Target | Value |
|---|---|
| Local / no ads | `'null'` |
| CrazyGames | `'crazygames'` |
| GameDistribution | `'gamedistribution'` |

## CrazyGames Submission Checklist
- [ ] Category set to **Arcade** (was incorrectly "Clicker" — change in portal)
- [ ] `config.adapter = 'crazygames'` in `js/ads.js`
- [ ] CrazyGames SDK v3 script tag added before `ads.js` in `index.html`
- [ ] `sdk.game.gameplayStart()` fires at MENU → PLAYING transition
- [ ] `sdk.game.gameplayStop()` fires on DYING state entry
- [ ] Midgame interstitial fires (1 per 3 runs, 60s gap) via `AdManager.showInterstitial()`
- [ ] Rewarded ad for double-score via `AdManager.offerDoubleScore()`
- [ ] **SPLASH state removed** — `state = 'MENU'` in `init()` (already done — no preloader)
- [ ] All art canvas-drawn — zero image files ✓
- [ ] Total asset size under 3 MB ✓
- [ ] 60 fps on mid-range Android/iOS ✓
- [ ] Portrait orientation (390×844 virtual canvas) ✓
- [ ] `node --check js/game.js` exits 0 ✓
- [ ] `node smoke-test.js` passes ✓
- [ ] `orbit_best` localStorage key persists across refreshes ✓
- [ ] Gameplay music plays during PLAYING state ✓
- [ ] Ambient drone plays in MENU ✓
- [ ] Shield power-up functional (collect → survive one hit) ✓
- [ ] Slow-mo power-up functional (hazards visibly slow) ✓
- [ ] Score milestone celebration at 10, 25, 50 ✓

## Key localStorage Keys
| Key | Content |
|---|---|
| `orbit_best` | Highest score |
| `orbit_runs` | Total runs played |
| `orbit_muted` | `'1'` = muted |
| `orbit_maxlevel` | Highest difficulty level reached |

## Known Deployment Constraints
- AudioContext requires user gesture on iOS/Safari — Audio module uses lazy init + try/catch.
- `localStorage` unavailable in some cross-origin iframes — best score fails silently.
- `navigator.vibrate()` unavailable on iOS — wrapped in try/catch.

## Portal Rejection History
- **Submitted:** 15.06.2026
- **Rejected reason:** "Overall quality does not meet publishing standards"
- **Root causes fixed:**
  1. Category changed from "Clicker" → "Arcade" (portal UI action required)
  2. Gameplay music sequencer added
  3. Shield and slow-mo power-ups added
  4. SPLASH preloader removed
  5. Score milestone celebrations added
  6. Haptic feedback added
- **Resubmit with all fixes above confirmed**
