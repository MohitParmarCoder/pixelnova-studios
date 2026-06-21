# Bounce Master — Deployment Guide

## Prerequisites

- No build step required. Pure HTML5 + Canvas2D.
- Requires a static file server or CDN.
- Shared dependencies: audio module, AdManager, Input module (same pattern as Orbit Hopper).

## Local Development

```bash
# Serve from the game directory
python3 -m http.server 8080 --directory path/to/bounce-master

# Syntax check (run after every JS edit)
node --check bounce-master.js
```

Access at `http://localhost:8080`.

## File Structure

```
bounce-master/
  index.html        # Canvas scaffold, script load order
  bounce-master.js  # Main game file (~375 lines), exposes BounceMaster global
  audio.js          # Shared audio module (ZzFX-based)
  ads.js            # Shared AdManager module
  input.js          # Shared pointer/keyboard input module
```

Script load order in `index.html` must follow:
```
audio.js → ads.js → input.js → bounce-master.js
```

## Ad Adapter Configuration

Set `config.adapter` at the top of `ads.js` before deploying:

| Target | Value |
|---|---|
| Local / test | `'null'` |
| CrazyGames | `'crazygames'` |
| GameDistribution | `'gamedistribution'` |

## Portal Submission Checklist

- [ ] Set correct `config.adapter` for target portal.
- [ ] Verify `gameplayStart()` fires on every MENU → PLAYING transition.
- [ ] Verify `gameplayStop()` fires on every PLAYING → DEAD transition.
- [ ] Verify `showInterstitial()` is called after `onRunEnd()` on death.
- [ ] Verify `offerDoubleScore(score, 'bouncemaster_best')` appears on DEAD screen.
- [ ] Test `localStorage['bouncemaster_best']` persists across sessions in portal environment.
- [ ] Confirm canvas letterboxes correctly on portal iframe dimensions.
- [ ] Confirm 60 fps on mid-range Android device.
- [ ] Confirm no console errors on iOS Safari.
- [ ] Confirm audio context resumes after first tap (mobile autoplay policy).

## CrazyGames Specific

- No preloader / splash branding screen required by CrazyGames policy. Bounce Master has no SPLASH state — compliant by default.
- Game must call `CrazyGames.SDK.gameplayStart()` and `gameplayStop()` via the adapter.

## GameDistribution Specific

- Include GD SDK script tag in `index.html` before `ads.js`.
- GD requires `gdsdk.showAd(gdsdk.AdType.Interstitial, callback)` format (handled inside the `gamedistribution` adapter).

## Performance Targets

| Metric | Target |
|---|---|
| Frame rate | 60 fps on mid-range mobile |
| Bundle size | < 3 MB total |
| First interaction | < 2 s on 4G |
| Audio latency | < 100 ms (ZzFX pre-rendered) |

## Environment Variables / Feature Flags

None. All configuration is done via `config.adapter` in `ads.js` and constants at the top of `bounce-master.js` (`PUCK_R`, `PADDLE_R`, `SPEED_CAP`, `AI_GOAL_LIMIT`, `PLAYER_GOAL_LIMIT`).
