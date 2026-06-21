# Asteroid Belt — Deployment Guide

## Overview
Asteroid Belt is a zero-dependency, zero-build HTML5 canvas game. Deployment is a static file upload. No npm, no bundler, no server-side logic required.

## File Structure
```
asteroid-belt/
  index.html        # entry point; loads scripts in dependency order
  js/
    audio.js        # Audio module (ZzFX inline); exposes Audio global
    ads.js          # AdManager; swap config.adapter for portal target
    input.js        # Unified pointer/keyboard input
    ui.js           # Canvas icon drawing primitives
    game.js         # AsteroidBelt game logic (~329 lines)
    main.js         # Bootstrap + rAF loop
```

## Script Load Order
Script tags in `index.html` must appear in this exact order:
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
python3 -m http.server 8080 --directory asteroid-belt
# Open http://localhost:8080
```

## Syntax Check (run after every edit)
```bash
node --check js/game.js
```

## Ad Adapter Configuration
Open `ads.js` and set `config.adapter` before deploying:

| Target | Value |
|---|---|
| Local / no ads | `'null'` |
| CrazyGames | `'crazygames'` |
| GameDistribution | `'gamedistribution'` |

Add the portal SDK `<script>` tag **before** `ads.js` in `index.html` when targeting a portal.

## Portal Submission Checklist
- [ ] `config.adapter` set to correct portal value in `ads.js`
- [ ] Portal SDK script tag added to `index.html`
- [ ] `node --check js/game.js` exits 0
- [ ] Smoke test: game loads, MENU shown, drag starts ship movement
- [ ] `asteroidbelt_best` persists across page refreshes
- [ ] Interstitial fires on life loss (frequency cap verified)
- [ ] `offerDoubleScore` prompt appears on DEAD screen
- [ ] Asteroid culling confirmed — no memory leak from unbounded `asteroids` array
- [ ] Total asset size under 3 MB
- [ ] Game runs at 60 fps on target device (no image files used)
- [ ] Portrait orientation lock set in `index.html` meta / manifest if required

## Static Hosting (non-portal)
Compatible with GitHub Pages, Netlify, Cloudflare Pages, and rawcdn.githack.com. No backend needed. Best score stored in `localStorage`.

## Known Deployment Constraints
- `localStorage` may be unavailable in sandboxed or cross-origin iframes on some portal platforms. Verify `getItem`/`setItem` work in the portal's embed environment, or gracefully handle `null` returns.
- Drag input requires `pointermove` or `touchmove` events. Verify the portal embedding method does not intercept or cancel pointer events before they reach the canvas.
- AudioContext lazy-starts on first user gesture; no deployment action needed for iOS/Safari compatibility.
