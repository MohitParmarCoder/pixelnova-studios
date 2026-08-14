# Memory Flip — Deployment Guide

## CrazyGames Submission Checklist

### Technical Requirements
- [ ] No external dependencies (✅ vanilla JS, no npm packages)
- [ ] No preloader screen (✅ `state` starts at `'MENU'` in `init()`)
- [ ] Runs at 60 FPS (✅ rAF loop with `dt > 0.05` clamping)
- [ ] No image files (✅ all art drawn with canvas paths via `drawSymbol()` and `drawCardBack()`)
- [ ] Portrait orientation: 390×844 (✅ `VW = 390`, `VH = 844`)
- [ ] Mobile touch support (✅ `tap(vx, vy)` exposed in public API)
- [ ] File size < 3 MB (✅ pure JS, no assets)

### Ad SDK Integration
- Adapter: set `config.adapter = 'crazygames'` in `js/ads.js`
- SDK script: add `<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>` to `index.html` before all game scripts
- Verify `AdManager.gameplayStart()` fires when tapping to start AND when advancing between levels
- Verify `AdManager.gameplayStop()` fires when the timer runs out (`gameOver()`)
- Verify `AdManager.showInterstitial()` fires at game-over and again when tapping RETRY from the DEAD screen

### Game Category
- Recommended CrazyGames category: **Puzzle** (memory/concentration genre)
- Secondary tags: Card, Brain, Casual

### Deployment Steps
1. Set `config.adapter = 'crazygames'` in `js/ads.js`
2. Add CrazyGames SDK script to `index.html` before other `<script>` tags
3. Test with browser DevTools mobile simulation at 390×844 (iPhone 14 preset)
4. Verify all 10 symbols render correctly (moon uses `globalCompositeOperation = 'destination-out'` — check for stacking-context issues)
5. Verify timer bar colour transitions (green → yellow → red) are visible
6. Play through at least 2 level transitions to confirm `AdManager.gameplayStart()` re-fires correctly
7. Let timer run out to confirm interstitial fires and RETRY flow works
8. Zip the game folder (`index.html` + `js/`)
9. Upload to CrazyGames portal
10. Set category to Puzzle
11. Add cover art (512×512 and 1280×720)

### GameDistribution Alternative
- Adapter: set `config.adapter = 'gamedistribution'` in `js/ads.js`
- Follow GD SDK v4 setup (`gdsdk` global, `GameDistribution.getInstance()`)
- GD requires the game to be playable without ads in case ad loading fails — Memory Flip's try/catch guards on all `AdManager` calls already satisfy this requirement
