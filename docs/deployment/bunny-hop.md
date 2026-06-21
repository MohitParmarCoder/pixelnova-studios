# Deployment Documentation: Bunny Hop

## Overview

Bunny Hop is a self-contained HTML5 canvas game. There is no build step, no npm dependencies, and no bundler. Deployment is static file hosting only.

## File Structure

```
bunny-hop/
  index.html        # entry point — loads all scripts in order
  js/
    audio.js        # ZzFX + ambient audio
    ads.js          # AdManager + portal adapters
    input.js        # pointer/keyboard input
    ui.js           # canvas icon drawing primitives
    game.js         # BunnyHop global (~360 lines)
    main.js         # bootstrap + rAF loop
```

Script load order in `index.html` is the dependency graph. Do not reorder.

## Local Development

```bash
python3 -m http.server 8080 --directory bunny-hop
# Open http://localhost:8080
```

Syntax check after any edit to `game.js`:
```bash
node --check bunny-hop/js/game.js
```

## Pre-Deployment Checklist

- [ ] Set `config.adapter` in `ads.js` to target portal (`'crazygames'` or `'gamedistribution'`).
- [ ] Confirm `localStorage` key `'bunnyhop_best'` does not conflict with other games hosted on same origin (each game uses a unique key — no conflict).
- [ ] Run syntax check: `node --check bunny-hop/js/game.js`
- [ ] Test full run: MENU → PLAYING → DEAD → double-score offer → MENU.
- [ ] Verify `showInterstitial()` fires on death with target adapter active.
- [ ] Verify audio plays on first tap (AudioContext lazy init).
- [ ] Confirm game renders correctly at portal's required resolution (typically 800×600 or 480×854).
- [ ] Check canvas letterboxing on desktop and mobile viewports.

## Portal Submission

### CrazyGames
- Adapter: `config.adapter = 'crazygames'`
- Include CrazyGames SDK script tag in `index.html` before `ads.js`.
- No SPLASH state present in Bunny Hop — compliant with "no preloader" policy.
- Submit `index.html` + all assets as a ZIP.

### GameDistribution
- Adapter: `config.adapter = 'gamedistribution'`
- Include GD SDK script tag in `index.html` before `ads.js`.
- No preloader — compliant.
- Submit ZIP with `index.html` at root.

## Static Hosting (Non-Portal)

Any static file server works:
```bash
# Netlify drag-and-drop: drop the bunny-hop/ folder
# GitHub Pages: set /bunny-hop as publish directory
# rawcdn.githack.com: reference index.html directly
```

No server-side logic required. No CORS configuration needed (all assets are same-origin).

## Performance Targets

| Metric | Target |
|---|---|
| Initial load | < 200 KB total (no images, canvas-drawn art) |
| Frame rate | 60 fps on mid-range mobile |
| Memory | Stable — platform/carrot arrays are bounded; off-screen entries pruned |

## Environment Variables / Configuration

None. All configuration is in `ads.js` (`config.adapter`) and constants at the top of `game.js` (`GRAVITY`, `BW`, `BH`, `PLAT_H`, `GEN_AHEAD`).

## Versioning

No build artifact versioning required. For cache-busting on re-deploy, append a query string to script tags in `index.html`:
```html
<script src="js/game.js?v=2"></script>
```
