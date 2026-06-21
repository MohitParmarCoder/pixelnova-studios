# Shadow Slide — Test & Performance Report

## Static Analysis
- Run `node --check js/game.js` to verify syntax. Expected: no errors.
- Confirm global `ShadowSlide` is exposed on `window` by the IIFE wrapper.
- Verify `BEST_KEY` constant equals `'shadowslide_best'` (grep for the string literal).
- Confirm `dt` clamp `if (dt > 0.05) dt = 0.05` is present in `update()`.

## Functional Tests

| # | Test | Input | Expected Result | Pass? |
|---|---|---|---|---|
| 1 | Initial state | Load page | Canvas shows MENU, lives=3, score=0 | — |
| 2 | Start game | Tap MENU | State → PLAYING, `AdManager.gameplayStart()` called | — |
| 3 | Jump | Tap during PLAYING (on platform) | Player vy set to -700 | — |
| 4 | Platform land | Player vy > 0 overlaps platform top | Score++, `gem` sound plays | — |
| 5 | Miss platform | Player falls below VH+20 | `_die()` called, life decremented, `crash` sound | — |
| 6 | Respawn | Lives > 0 after _die | Platforms reset, player placed on first platform | — |
| 7 | Third miss | Lives === 0 after _die | State → DEAD, `lose` sound, `gameplayStop()`+`onRunEnd()` | — |
| 8 | Double-score | Tap DEAD screen | `showInterstitial()` + `offerDoubleScore()` called | — |
| 9 | Speed cap | Score large enough | scrollSpeed does not exceed 500 | — |
| 10 | Darkness overlay | Any PLAYING frame | Spotlight circle visible at player X=100, rest dark | — |
| 11 | Platform prune | Platform scrolls past x=0 | Removed from array, no memory leak | — |
| 12 | dt clamp | Frame stall >50 ms | dt capped at 0.05 — no physics explosion | — |

## Performance Targets
| Metric | Target |
|---|---|
| Frame rate | 60 fps sustained on mid-range mobile |
| Canvas resolution | 390×844 virtual px |
| Peak platform count | ≤ 30 objects in memory at once |
| Darkness overlay cost | < 2 ms per frame (offscreen canvas composite) |
| Total JS file size | < 50 KB uncompressed |

## Edge Cases
- **Zero-width gap**: If random gap generator produces < 90 px, the player can trivially hop every platform — ensure gap minimum is enforced.
- **Instant death on spawn**: If `_seedPlatforms()` places first platform too far right, player can fall before seeing any platform — verify first platform is always within `PLAYER_X` reach at spawn.
- **MAX_SPEED overshoot**: If `SPEED_INC` is applied multiple times before the clamp check, speed could briefly exceed 500. Confirm clamp is applied after every increment.
- **localStorage unavailable**: If `localStorage` is blocked (private browsing), `BEST_KEY` read/write should fail silently without crashing.

## Regression Notes
- After any change to `_drawDarknessOverlay()`, verify `destination-out` globalCompositeOperation is reset to `'source-over'` before the next draw call; failing to restore it will blank the entire canvas.
- After any change to `_seedPlatforms()`, run test #1 and #6 to confirm no spawn-death regression.
- After adjusting `SPEED_INC` or `MAX_SPEED`, re-run test #9 and do a subjective playtest to ensure difficulty curve is not broken.
