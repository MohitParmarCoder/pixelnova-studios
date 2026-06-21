# Mirror Tap — Test & Performance Report

## Static Analysis
- Syntax: `node --check` passes
- dt clamping: present — `if (dt > 0.05) dt = 0.05;` at top of `update()`
- Speed cap: N/A (no physics; `showTimer` is the only time-based progression)

## Functional Tests
| Test Case | Expected | Status |
|-----------|----------|--------|
| Menu loads | `state === 'MENU'`, title and instructions rendered | ✅ |
| Tap on MENU starts game | `state === 'PLAYING'`, `score = 0`, `lives = 3`, `round = 0`, `phase = 'SHOW'` | ✅ |
| SHOW phase timer expires | `phase` transitions from `'SHOW'` to `'TAP'` | ✅ |
| Correct mirror tap | Index pushed to `rightTaps`, green dot shown, `Audio.play('tap')` | ✅ |
| All pattern taps correct | `score++`, `round++`, 500 ms delay, `newRound()` called | ✅ |
| Duplicate tap rejected | `rightTaps.indexOf(i) >= 0` guard prevents double-counting | ✅ |
| Left-half tap rejected | `x < VW/2` guard returns early silently | ✅ |
| Wrong tap | `lives--`, `Audio.play('crash')`, lives HUD updates | ✅ |
| Third wrong tap | `lives <= 0`, `state = 'DEAD'`, `AdManager.gameplayStop()` called | ✅ |
| Score beats best | `best` updated in `tap()` inline: `if (score > best) best = score` | ✅ |
| Pattern size increases | Round 0: 3 dots; Round 2: 4 dots; Round 4: 5 dots (via `min(3+floor(round/2), DOTS)`) | ✅ |
| Max pattern size cap | Pattern capped at 8 dots (`DOTS` constant) | ✅ |
| Show timer scales with pattern | `showTimer = 1.5 + n * 0.2` — longer show for larger patterns | ✅ |
| Ad on game end | `gameplayStop`, `onRunEnd`, `showInterstitial`, `offerDoubleScore` called | ✅ |
| Tap during SHOW phase | Silently ignored (`phase !== 'TAP'` guard in `tap()`) | ✅ |
| Retry from DEAD | `startGame()` called, full reset | ✅ |

## Performance Targets
- Target: 60 FPS on mid-range mobile
- Canvas ops per frame (PLAYING state):
  - Background fill: 1 fillRect
  - Centre line stroke: 1 beginPath/stroke
  - 8 left dots + 8 right dots = 16 arc/fill calls, each with conditional `shadowBlur`
  - HUD: 3–4 fillText calls
  - DEAD overlay: additional fillRect + 4 fillText
- This is an extremely lightweight draw — well within 60 FPS budget on any device
- Particle system: None

## Edge Cases
- **`setTimeout` race condition:** `newRound()` is called via `setTimeout(function() { if (state==='PLAYING') newRound(); }, 500)`. If the player triggers multiple round completions faster than 500 ms (not possible given input guards) or if the game dies within 500 ms of a round completing, the `state === 'PLAYING'` guard prevents `newRound()` from firing after death — correctly handled.
- **All 8 dots active:** When `n === DOTS === 8`, `leftPattern` contains all indices; any right-half dot tap is correct; the round completes after 8 taps. No edge case, but the game becomes trivially easy to "win" rounds once spatial memory of dot positions is established.
- **Dot positions randomised per round:** `makeDotPositions()` is called at the start of every round (inside `newRound()`), so positions are not stable between rounds. This means the player cannot learn dot locations — a potential design issue but not a bug.
- **`showInterstitial` without try/catch:** `AdManager.showInterstitial(() => {})` in `tap()` is not inside a try/catch. Other games wrap this call. If `AdManager` is undefined or `showInterstitial` throws, this line will throw an uncaught exception. Low risk if the harness always provides `AdManager`, but worth guarding.
- **Arrow function syntax:** The `() => {}` callback in `AdManager.showInterstitial(() => {})` uses ES6 arrow syntax — consistent with the rest of the file which uses ES5 `var`; not a bug but inconsistent style.

## Regression Notes
- PR #22 confirmed `node --check` passes
- dt clamping confirmed present
- `offerDoubleScore` uses key `'mirrortap_best'` — consistent with naming convention
