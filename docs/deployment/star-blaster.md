# Star Blaster — Deployment Guide

## Overview
Star Blaster is a zero-dependency HTML5 canvas game (vertical space shoot-em-up game). Deployment is a static file upload — no build step, no bundler, no npm install required.

## File Structure
```
star-blaster/
  index.html        # entry point; loads scripts in dependency order
  js/
    audio.js        # Audio module (ZzFX inline); exposes Audio global
    ads.js          # AdManager; swap config.adapter for portal target
    input.js        # Unified pointer/keyboard input
    ui.js           # Canvas icon drawing primitives
    game.js         # StarBlaster game logic
    main.js         # Bootstrap + rAF loop
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
python3 -m http.server 8080 --directory star-blaster
# Open http://localhost:8080
node --check star-blaster/js/game.js   # syntax check
```

## Ad Adapter Configuration
Open `js/ads.js` and set `config.adapter`:

| Target | Value |
|---|---|
| Local / no ads | `'null'` |
| CrazyGames | `'crazygames'` |
| GameDistribution | `'gamedistribution'` |

Add the corresponding SDK `<script>` tag in `index.html` **before** `ads.js`.

## CrazyGames Submission Checklist
- [ ] Category set to correct genre (Arcade / Puzzle / Skill) — NOT Clicker
- [ ] `config.adapter = 'crazygames'` in `ads.js`
- [ ] CrazyGames SDK v3 script tag added before `ads.js` in `index.html`
- [ ] `sdk.game.gameplayStart()` fires at game start
- [ ] `sdk.game.gameplayStop()` fires on death/game-over
- [ ] Midgame interstitial fires via `sdk.ad.requestAd('midgame', ...)` — frequency-capped (1 per 3 runs, 60s gap)
- [ ] Rewarded ad (`sdk.ad.requestAd('rewarded', ...)`) for double-score offer
- [ ] No preloader screen (loads directly to MENU)
- [ ] All art drawn on canvas — zero image files
- [ ] Total asset size under 3 MB
- [ ] 60 fps on mid-range Android/iOS device
- [ ] Portrait orientation (390×844 virtual canvas)
- [ ] `node --check js/game.js` exits 0
- [ ] localStorage key `starblaster_best` persists best score across refreshes
- [ ] Game title and description match portal listing

## GameDistribution Submission Checklist
- [ ] `config.adapter = 'gamedistribution'` in `ads.js`
- [ ] GameDistribution SDK script tag added
- [ ] `gdsdk.showAd()` fires on game-over
- [ ] Game ID registered in GD dashboard
- [ ] Same quality checks as CrazyGames above

## Static Hosting (non-portal)
Any static host works (GitHub Pages, Netlify, Cloudflare Pages). No backend needed. `localStorage` used for score persistence.

## Known Deployment Constraints
- `localStorage` unavailable in some cross-origin iframe contexts — gracefully handle `getItem` returning `null`.
- AudioContext requires a user gesture on iOS/Safari — Audio module uses lazy init + try/catch.
- Ensure portal iframe allows `vibrate` API if haptic feedback is desired.
