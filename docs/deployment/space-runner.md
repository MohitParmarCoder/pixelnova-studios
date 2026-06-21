# Space Runner — Deployment Guide

## CrazyGames Submission Checklist

### Technical Requirements
- [ ] All art is canvas-drawn — no external image files
- [ ] Total bundle size < 3 MB (verify with `du -sh` on game directory)
- [ ] Game runs at 60 fps on a mid-range Android device (test with Chrome DevTools throttling)
- [ ] `node --check js/game.js` passes with no errors
- [ ] Smoke test passes: `node smoke-test.js`
- [ ] dt clamped to 0.05 s (prevents physics explosion on slow frames)
- [ ] No `console.error` or uncaught exceptions in browser console during a full run
- [ ] Game loads and reaches MENU within 3 seconds on a 10 Mbps connection
- [ ] `localStorage` key is namespaced: `spacerunner_best` (no collision with other games)
- [ ] SPLASH/preloader screen removed or skipped (CrazyGames prohibits preloaders — set initial state to `'MENU'` in `init()`)

### Ad SDK Integration
- [ ] `config.adapter` in `ads.js` set to `'crazygames'`
- [ ] CrazyGames SDK script tag added to `index.html` before `game.js`
- [ ] `gameplayStart()` fires when PLAYING state begins
- [ ] `gameplayStop()` fires immediately on death
- [ ] Interstitial fires after `onRunEnd()` — frequency cap respected (1 per 3 runs, 60 s gap)
- [ ] Rewarded ad (`offerDoubleScore`) tested with CrazyGames sandbox
- [ ] SDK integration tested in CrazyGames preview environment

### Game Category
- Primary: **Arcade**
- Secondary: **Shooter**
- Tags: `shoot-em-up`, `arcade`, `aliens`, `wave`, `one-touch`

### Deployment Steps
1. Set `config.adapter = 'crazygames'` in `ads.js`.
2. Remove or skip SPLASH state: set `state = 'MENU'` in `init()`.
3. Run `node --check js/game.js` and `node smoke-test.js`.
4. Zip the game directory (index.html + js/ folder).
5. Upload zip to CrazyGames developer portal.
6. Fill in metadata: title "Space Runner", description, category, tags.
7. Submit for review; address any feedback from CrazyGames QA.

## GameDistribution Alternative
1. Set `config.adapter = 'gamedistribution'` in `ads.js`.
2. Add GameDistribution SDK script to `index.html`.
3. Map `showInterstitial()` to `gdsdk.showAd('interstitial')` in the GD adapter.
4. Map `offerDoubleScore()` to `gdsdk.showAd('rewarded')`.
5. GameDistribution does not require removal of preloaders, but removing SPLASH is still recommended for faster perceived load time.
6. Submit via the GameDistribution developer dashboard with the same zip package.
7. GameDistribution requires a minimum of 100 plays before revenue reporting activates.
