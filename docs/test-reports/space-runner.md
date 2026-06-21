# Space Runner — Test & Performance Report

## Static Analysis
- Run `node --check js/game.js` after every edit to catch syntax errors before browser testing.
- No linter configured; ESLint with `env: {browser: true, es2020: true}` is recommended.
- No TypeScript; JSDoc comments on public API (`getState`, `getScore`) are advised.

## Functional Tests

| # | Test Case | Expected Result | Pass Criteria |
|---|---|---|---|
| 1 | Load game in browser | MENU state displayed, 20 stars visible | `SpaceRunner.getState() === 'MENU'` |
| 2 | Tap MENU screen | State transitions to PLAYING, wave=1, score=0, lives=3 | `getState() === 'PLAYING'` |
| 3 | Ship tap-to-move | Ship x snaps to tap x, clamped 30–VW-30 | Ship does not leave canvas |
| 4 | Auto-fire fires | Bullets appear and travel upward every ~0.8 s | Bullets visible in `drawPlaying` |
| 5 | Alien killed | Score increases by 10*wave, particle explosion shown | `getScore()` increments correctly |
| 6 | All 15 aliens killed | Wave increments, new grid spawns, alienSpeed increases | `wave` increments in state |
| 7 | Alien reaches VH-100 | Game ends, state = DEAD | `getState() === 'DEAD'` |
| 8 | Player hit 3 times | Lives reach 0, state = DEAD | `getState() === 'DEAD'` |
| 9 | Best score saved | After death, `localStorage.spacerunner_best` updated if score > previous best | localStorage value matches |
| 10 | AdManager hooks called | `gameplayStart()` on startGame; `gameplayStop`+`onRunEnd`+`showInterstitial`+`offerDoubleScore` on death | Check with mock AdManager |
| 11 | dt clamp | Simulate 200 ms frame; dt treated as 0.05 s | No physics explosion |
| 12 | Wave 10 alien speed | `80 * 1.1^9 ≈ 190.1 px/s`; wave 20 capped at 400 | Speed does not exceed 400 |

## Performance Targets
| Metric | Target |
|---|---|
| Frame rate | 60 fps on mid-range mobile |
| Total bundle size | < 3 MB (no assets; all canvas-drawn) |
| Particle count | Max 8 × (number of simultaneous explosions); GC'd when life ≤ 0 |
| Alien count | 15 per wave; O(n²) collision check acceptable at this scale |
| Memory | No persistent growth over multiple waves (arrays cleared each wave) |

## Edge Cases
- **Wave 1 with no aliens spawned**: Should not occur; `spawnWave()` called in `startGame()` and after wave clear.
- **Alien bullet fired with no living aliens**: Guard with `aliens.filter(a => a.alive)` before random shooter selection.
- **Tab hidden for 10 s then restored**: dt clamp at 0.05 s prevents position teleports.
- **Tap during DEAD screen immediately**: Could accidentally restart; consider a 500 ms input lock after death.
- **Best score as NaN**: Occurs if `localStorage` value is corrupt; guard with `parseInt(...) || 0`.

## Regression Notes
- If `alienSpeed` formula changes, re-verify wave-20 cap at 400.
- If particle count changes from 8, update this document and check mobile performance.
- `onTap` clamping logic must be re-tested if virtual canvas resolution changes.
- Ad hook call order (`gameplayStop` before `onRunEnd` before `showInterstitial`) must be preserved per AdManager contract.
