# Arrow Dodge — Deployment Guide

## Overview
Arrow Dodge is a zero-dependency HTML5 canvas game. Deployment is a static file upload — no build step, no bundler, no npm install required.

## File Structure
```
arrow-dodge/
  index.html        # entry point; loads scripts in dependency order
  js/
    audio.js        # Audio module (ZzFX inline); exposes Audio global
    ads.js          # AdManager; swap config.adapter for portal target
    input.js        # Unified pointer/keyboard input
    ui.js           # Canvas icon drawing primitives
    game.js         # ArrowDodge game logic (~399 lines)
    main.js         # Bootstrap + rAF loop
```

## Script Load Order
Script tags in `index.html` must appear in this exact order (each file depends on the previous):
```html
<script src="js/audio.js"></script>
<script src="js/ads.js"></script>
<script src="js/input.js"></script>
<script src="js/ui.js"></script>
<script src="js/game.js"></script>
<script src="js/main.js"></script>
```

## Local Development Server
```bash
python3 -m http.server 8080 --directory arrow-dodge
# Open http://localhost:8080
```

## Syntax Check (run after every edit)
```bash
node --check js/game.js
```

## Ad Adapter Configuration
Before deploying to a portal, open `ads.js` and set `config.adapter`:

| Target | Value |
|---|---|
| Local / no ads | `'null'` |
| CrazyGames | `'crazygames'` |
| GameDistribution | `'gamedistribution'` |

Add the corresponding SDK `<script>` tag in `index.html` **before** `ads.js` when targeting a portal.

## Portal Submission Checklist
- [ ] `config.adapter` set to correct portal value in `ads.js`
- [ ] Portal SDK script tag added to `index.html`
- [ ] `node --check js/game.js` exits 0
- [ ] Smoke test pass: game loads, MENU shown, tap starts run
- [ ] `arrowdodge_best` localStorage key verified to persist across page refreshes
- [ ] Interstitial fires on life loss (check browser console / ad SDK debug mode)
- [ ] `offerDoubleScore` rewarded ad prompt appears on DEAD screen
- [ ] Total asset size under 3 MB
- [ ] Game runs at 60 fps on target device (no image files — all canvas-drawn)
- [ ] Portrait orientation lock set in `index.html` meta / manifest if required by portal

## Static Hosting (non-portal)
Any static host works (GitHub Pages, Netlify, Cloudflare Pages, rawcdn.githack.com). No server-side logic required. `localStorage` is used for best-score persistence — no backend needed.

## Known Deployment Constraints
- `localStorage` is unavailable in some cross-origin iframe contexts. Verify the portal embedding method supports `localStorage` or gracefully handles `getItem` returning `null`.
- AudioContext requires a user gesture to start on iOS/Safari. The `Audio` module uses lazy init + try/catch; no additional deployment action needed.
