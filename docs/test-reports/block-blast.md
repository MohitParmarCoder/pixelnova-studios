# Block Blast — Test Report

## Static Analysis

- **Syntax check:** `node --check js/game.js` — expected pass (ES6, no modules).
- **Global leakage:** Only `BlockBlast` exposed on `window`; `grid`, `blastParticles`, `newRowTimer` must be closure-private.
- **Canvas API usage:** 2D context only; no image loading.
- **No external dependencies:** Self-contained.
- **Grid bounds:** `floodFill` must guard against out-of-bounds access on a `ROWS×COLS` grid during edge-cell traversal.

## Functional Test Table

| Test ID | Scenario | Expected Result | Risk |
|---|---|---|---|
| BB-01 | Tap MENU | Transitions to PLAYING, `startGame()` called, `gameplayStart()` fired | High |
| BB-02 | Tap single isolated block | `floodFill` returns group of 1, no blast, `Audio.play('tap')` only | High |
| BB-03 | Tap group of 2+ same-color blocks | Group blasted, `score += cells.length`, 8 particles per cell spawned | High |
| BB-04 | Blast removes blocks mid-column | `applyGravity()` drops floating blocks down to fill gap | High |
| BB-05 | `newRowTimer` reaches 0 | `addNewRow()` shifts grid up, fills bottom row with random colors, timer resets to 5 s | High |
| BB-06 | Top row has occupied cell after `addNewRow()` | `killPlayer()` called → state=DEAD | High |
| BB-07 | Tap DEAD screen | `state='MENU'` | Medium |
| BB-08 | All cells in top row are empty after row rise | Game continues normally | Medium |
| BB-09 | Blast clears entire grid | Grid all `-1`; next `addNewRow()` fills bottom row normally | Medium |
| BB-10 | Particles expire | `blastParticles` entries removed when lifetime elapsed | Low |
| BB-11 | Timer bar display | Bar width proportional to `newRowTimer / NEW_ROW_INTERVAL` | Low |
| BB-12 | `score` display top-center | Updates immediately after blast | Low |
| BB-13 | `best` updated after death | `blockblast_best` in `localStorage` updated if `score > best` | Medium |
| BB-14 | `offerDoubleScore` called | `offerDoubleScore(score, 'blockblast_best')` invoked in `killPlayer()` | Medium |
| BB-15 | Screen shake on large blast | `shakeTime` and `shakeAmt` set, canvas offset applied during render | Low |
| BB-16 | `Audio.play('gem')` on blast | Called once per successful blast regardless of group size | Low |
| BB-17 | `Audio.play('lose')` on death | Called once in `killPlayer()` | Low |
| BB-18 | Flood fill across full grid | Must not stack-overflow on maximum 63-cell group; iterative implementation required | High |

## Performance

- **Target:** 60 fps on mid-range mobile.
- **Rendering cost:** Moderate — up to 63 colored rectangles per frame plus particles. Grid draw is O(ROWS*COLS) = O(63) rectangle calls per frame.
- **Particle cost:** Up to 63 cells × 8 particles = 504 simultaneous particles on a full-grid blast. Each particle is a small filled circle. This is the highest-cost scenario — verify frame time stays under 16 ms.
- **Flood fill cost:** O(ROWS*COLS) = O(63) in worst case — negligible.
- **Memory:** `blastParticles` array grows on each blast; ensure expired particles are spliced out promptly to avoid unbounded growth.

## Edge Cases

| Case | Concern |
|---|---|
| Flood fill on corner cell (0,0) | Boundary guard needed: col-1 and row-1 access must check `>= 0` |
| `addNewRow()` when grid already full | Should trigger `killPlayer()` immediately; do not push content off-canvas |
| Multiple blasts before gravity settles | `applyGravity()` called immediately after each blast — verify it runs synchronously before next tap |
| `CELL` rounding vs. grid pixel gaps | `floor(VW/(COLS+1))` may leave 1–2 px gap at right edge; cosmetic but verify no tap-detection misalignment |
| `newRowTimer` negative accumulation | Timer decremented by `dt` each frame; clamp to 0 before triggering `addNewRow()` to avoid double-trigger |
| All-same-color grid | Full-grid blast possible; 504 particles simultaneously — performance regression test recommended |
| `localStorage` unavailable | `best` read/write should be guarded with try/catch |
