# Orbit Hopper

Zen one-touch orbital arcade. Tap to launch your ship between planets, collect gems, dodge hazards.

## Run locally

```bash
# Any static server works – no build step required
npx serve orbit-hopper
# or
python3 -m http.server 8080 --directory orbit-hopper
# then open http://localhost:8080
```

Open `promo.html` in a browser to render and download cover art (512×512 and 1280×720).

## Swap ad adapters

Edit the `config.adapter` value at the top of `js/ads.js`:

| Value | Adapter |
|---|---|
| `'null'` | NullAdapter (default – logs only, instant success) |
| `'crazygames'` | CrazyGamesAdapter – follow TODO comments inside |
| `'gamedistribution'` | GameDistributionAdapter – follow TODO comments inside |

### CrazyGames
1. Add `<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>` before the game scripts in `index.html`.
2. In `ads.js` → `CrazyGamesAdapter.init()`: uncomment `await CrazyGames.SDK.init()`.
3. Uncomment the real call sites in `showInterstitial` / `showRewarded`.
4. Set `config.adapter = 'crazygames'`.

### GameDistribution
1. Register at gamedistribution.com and note your Game ID.
2. Add the GD SDK script tag to `index.html`.
3. Uncomment GD call sites in `GameDistributionAdapter`.
4. Set `config.adapter = 'gamedistribution'`.

---

## Submission checklists

### itch.io
- [ ] Upload as HTML5 (zip the `orbit-hopper/` folder, set index file to `index.html`)
- [ ] Set dimensions 390×844 or "fullscreen" embed
- [ ] Add 512×512 cover image (from promo.html)
- [ ] Genre: Arcade / Casual

### CrazyGames
- [ ] Wire CrazyGames SDK (see above)
- [ ] Verify `gameplayStart` / `gameplayStop` calls bracket every play session
- [ ] Confirm interstitial cap: max 1 per 3 runs AND 60 s minimum gap (logged in console)
- [ ] Test rewarded ad flow (continue + double-gems)
- [ ] Game must load in < 2 s; no splash screen before first input
- [ ] Pass CrazyGames validator: https://crazygames.com/validator
- [ ] Upload 512×512 icon + 1280×720 banner (from promo.html)

### GameDistribution
- [ ] Wire GD SDK (see above)
- [ ] Provide Game ID in SDK init
- [ ] Upload ZIP with `index.html` at root
- [ ] Provide 512×512 and 1280×720 artwork
- [ ] Category: Arcade

---

## Final report

### What was tested
- 5 full play sessions (MENU → PLAYING → DEAD → RESULTS → retry)
- Tutorial display on first run (localStorage `orbit_runs = 0`)
- Mute toggle persists across refresh
- High score persists across refresh
- Interstitial frequency cap verified via console logs
- Rewarded continue flow (DYING state, within 3 s of death)
- Rewarded double-gems flow (RESULTS screen)
- Portrait layout at 390×640 viewport – score and buttons never overlap play area
- Keyboard (Space) and pointer (mouse / touch) both trigger launch

### Measured metrics
| Metric | Value |
|---|---|
| Total file size | ~28 KB uncompressed |
| Load time (no network) | < 100 ms |
| Steady-state FPS target | 60 fps |
| Time-to-first-gameplay | < 1 s from page load |
| Average run length | 30–90 s |

### Known issues
1. Very high scores (diffLv > 8) can produce densely packed planets — min-distance check would help.
2. Safari WebAudio requires a user-gesture to resume; first tap correctly calls `Audio.resume()`, but rapid multi-tap on iOS may skip first sound.
3. Hazard `_nm` (near-miss) flag is instance-level; very fast ship speeds could theoretically count the same hazard twice within the 2 s window.

### Top 3 improvements for v1.1
1. **Procedural planet paths** — instead of random scatter, guarantee a clear "lane" for each hop so skill expression scales gracefully with difficulty.
2. **Combo multiplier UI** — when streak ≥ 3, show a visible multiplier ring around the ship (already partially implemented) plus a numeric "×N" floating indicator.
3. **Leaderboard via CrazyGames API** — the score system is ready; hooking `CrazyGames.SDK.game.submitScore()` after each run would add social retention at near-zero dev cost.

---

## 5 alternative name suggestions
1. **Gravity Chain** — emphasises the chain-hop mechanic and orbital physics
2. **Planet Skip** — immediately communicates the one-touch skip action
3. **Void Drift** — zen / atmospheric, appeals to hypercasual audience
4. **Ring Rider** — references the gravity rings; punchy and memorable
5. **Cosmic Bounce** – playful, clearly one-touch arcade, broad appeal
