# Memory Flip — Test & Performance Report

## Static Analysis
- Syntax: `node --check` passes (vanilla JS, no build step)
- dt clamping: present — `if (dt > 0.05) dt = 0.05;` at top of `update()`
- Speed cap: N/A (no continuous movement; flip animation uses dt-stepped approach toward `target`)

## Functional Tests
| Test Case | Expected | Status |
|-----------|----------|--------|
| Menu loads | `state === 'MENU'`, title text rendered, symbol row animated | ✅ |
| Tap on MENU starts game | `state === 'PLAYING'`, `score === 0`, `level === 1`, 4×4 grid built | ✅ |
| Tap a face-down card | Card `target` set to 1, flip animation begins, `first` index stored | ✅ |
| Tap a second matching card | Both `matched = true`, `pulse = 1`, score incremented by `100 + floor(timeLeft)` | ✅ |
| Tap a second mismatching card | `resolveTimer = 0.6`, both cards flip back after hold, `moves` incremented | ✅ |
| Tap during mismatch hold | Input ignored (`resolveTimer > 0` guard) | ✅ |
| Tap already-selected card | Input ignored (`i === first` guard) | ✅ |
| All cards matched | `allMatched()` returns true, `levelWin()` called, `score += floor(timeLeft)*5` | ✅ |
| WIN banner fast-forward | Tap during WIN sets `winTimer = 0`, next `update()` advances level | ✅ |
| Level advance | `level++`, new grid built via `gridForLevel()`, `levelTime` recalculated | ✅ |
| Timer runs out | `timeLeft <= 0` triggers `gameOver()`, `state = 'DEAD'` | ✅ |
| Best score saved | `if (score > _best) _best = score` in both `gameOver()` and `levelWin()` | ✅ |
| Ad on game end | `runEnded()` calls `gameplayStop`, `onRunEnd`, `showInterstitial`, `offerDoubleScore` | ✅ |
| Retry from DEAD | `showInterstitial(cb)` callback calls `startGame()` | ✅ |
| `getScore()` / `getState()` / `getBest()` | Public accessors return live values | ✅ |

## Performance Targets
- Target: 60 FPS on mid-range mobile
- Canvas ops per frame (PLAYING state):
  - `clearBg()`: 1 fillRect + 1 radial gradient fill
  - `drawHUD()`: ~6 fillText + 2 roundRect fills + 1 roundRect stroke
  - `drawBoard()`: up to 30 cards × (roundRect fill + roundRect stroke + symbol draw); symbol draw uses `shadowBlur` per card — the most expensive path
  - `shadowBlur` is set per card, including on matched cards; this is the primary performance concern on low-end devices at 5×6 (30 cards)
- Particle system: No dedicated particle system; `pulse` glow expansion on matched cards is lightweight

## Edge Cases
- **Moon symbol** uses `globalCompositeOperation = 'destination-out'` to punch a hole — any mismatched `ctx.restore()` order would corrupt rendering; currently properly guarded with `ctx.save()/restore()`
- **Pairs count vs SYMBOLS array:** 5×6 grid needs 15 pairs but `SYMBOLS` only has 10; `SYMBOLS[i % SYMBOLS.length]` cycles symbols, so levels 4+ repeat symbols with different card positions — matching relies on `sym.id` equality, which still works correctly
- **`resolveTimer` race:** If `gameOver()` fires mid-resolve (timer runs out while two cards are face-up), `first`/`second` are left non-(-1) but `state` changes to `DEAD` — harmless since `update()` early-returns on non-PLAYING states
- **Grid overflow:** `layoutGrid()` does not enforce a hard min card size; on screens narrower than 390 px virtual width, gaps could cause cards to run off-canvas, but the harness always scales to 390 virtual width

## Regression Notes
- PR #22 verified `node --check` passes for this game
- dt clamping was confirmed present at the top of `update()`
- `AdManager.offerDoubleScore` call uses `'memflip_best'` key, consistent with the host's localStorage key naming convention
