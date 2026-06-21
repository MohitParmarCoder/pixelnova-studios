# Block Breaker — Deployment Guide

## CrazyGames Pre-Submission Checklist

| Requirement | Status | Notes |
|---|---|---|
| No preloader / splash screen | Pass | Game opens directly to MENU state — no timed splash like the SPLASH state in Orbit Hopper; compliant with CrazyGames "no custom preloader" rule |
| No external image files | Pass | All art is canvas-drawn; zero `<img>` tags or image fetches |
| Canvas-only rendering | Pass | Single `<canvas>` element; no DOM-based game UI |
| 60 fps target | Verify | Profile on mid-range Android device; particle bursts are the primary risk |
| Bundle size < 3 MB | Verify | Measure zipped package; audio assets (if any) are the most likely size contributor |
| `gameplayStart()` called at correct point | Pass | Called in `tap()` on MENU → PLAYING transition only |
| `gameplayStop()` called before every ad | Pass | Called in `_die()` before `showInterstitial()` |
| Responsive / letterboxed canvas | Verify | Confirm canvas scales correctly at 4:3, 16:9, and tall-mobile (9:19.5) aspect ratios |
| No alert / confirm / prompt dialogs | Verify | Scan codebase; CrazyGames forbids native browser dialogs |
| HTTPS-safe (no mixed content) | Pass | No external resources loaded at runtime |

## SDK Integration Steps

1. Locate `config.adapter` at the top of the AdManager module (shared with Orbit Hopper in this project).
2. Change the value from `'null'` to `'crazygames'`.
3. Include the CrazyGames SDK script in the host HTML:
   ```html
   <script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>
   ```
4. Verify that `AdManager.gameplayStart()` resolves to `CrazyGames.SDK.game.gameplayStart()` by running a test session in the CrazyGames developer portal preview tool.
5. Verify that `AdManager.showInterstitial()` resolves to `CrazyGames.SDK.ad.requestAd('midgame', ...)` and that gameplay is not resumed until the `adFinished` or `adError` callback fires.
6. Verify that `offerDoubleScore()` resolves to `CrazyGames.SDK.ad.requestAd('rewarded', ...)` and that the score doubling and localStorage update happen inside the `adFinished` callback only.
7. Test the full flow in incognito mode (clean localStorage) and confirm `blockbreaker_best` is written correctly after a rewarded ad completes.

## Suggested Portal Metadata

| Field | Recommended value |
|---|---|
| Category | Arcade |
| Sub-category | Breakout / Brick Breaker |
| Tags | arcade, breakout, brick breaker, classic, casual, one-touch |
| Controls | Mouse, Touch |
| Orientation | Portrait (primary) / Landscape (supported if canvas letterboxes) |
| Age rating | 3+ |

## Deployment Steps

1. Run a final syntax check:
   ```bash
   node --check block-breaker.js
   ```
2. Set `config.adapter = 'crazygames'` in AdManager.
3. Create the submission zip containing exactly:
   - `index.html`
   - `block-breaker.js` (and any shared modules: `audio.js`, `ads.js`, `input.js`)
   - No subdirectories, no `.DS_Store`, no source maps unless explicitly requested
4. Log in to the CrazyGames developer portal at `developer.crazygames.com`.
5. Create a new game entry, upload the zip, and run the built-in preview to confirm rendering and SDK handshakes.
6. Fill in title, description, screenshots (at least 1280×720), and a square thumbnail (512×512). Use `promo.html` if a cover-art renderer exists for this game, or capture screenshots from the running canvas.
7. Submit for review. Typical review turnaround is 3–7 business days.

## GameDistribution Alternative

GameDistribution (GD) is a secondary portal that shares the same AdManager adapter pattern. To target GD instead of (or in addition to) CrazyGames:

1. Set `config.adapter = 'gamedistribution'` in AdManager.
2. Include the GD SDK:
   ```html
   <script src="https://html5.api.gamedistribution.com/main.min.js"></script>
   ```
3. Register a new game at `gamedistribution.com/developer` and obtain a Game ID.
4. The `gameplayStart` / `gameplayStop` / `showInterstitial` call pattern is identical from the game's perspective — only the AdManager adapter changes.
5. GD requires a minimum of 5,000 monthly active players on your existing titles before premium monetization is enabled for new games; plan for an initial unpaid traffic period.
6. GD does not support the rewarded-ad (`offerDoubleScore`) flow natively in all configurations — confirm rewarded support with your GD account manager before shipping that feature on GD.
