# Bomb Squad — Test Report

## Static Analysis Findings

| Property | Finding |
|---|---|
| Global namespace | Single global `BombSquad` — no namespace pollution beyond this one identifier |
| File size | ~461 lines; within manageable single-file scope, no refactoring required |
| Build step | None — plain JS loaded via `<script>` tag, syntax errors would be caught at parse time |
| Module system | None — relies on shared globals (Audio, AdManager, Input) loaded before this script |
| Lint | No linter configured; recommend running `node --check bomb-squad.js` as a minimum syntax check |
| Dependencies | Implicit runtime dependencies on Audio, AdManager, and Input globals; load order must be enforced in HTML |

## Functional Test Cases

| Test Case | Input | Expected | Status |
|---|---|---|---|
| First tap always safe | Tap any cell on a fresh board (firstTap=true) | Mines are placed avoiding the tapped cell; tapped cell is revealed without hitting a mine | Pass |
| Flood reveal on zero-adjacency cell | Tap an unrevealed cell with adjacentMines===0 | floodReveal() recursively reveals all connected zero-adjacency cells and their numbered borders | Pass |
| Flag placement toggles cell state | Enable flagMode, tap an unrevealed cell; tap again | First tap sets cell.flagged=true and increments flagsPlaced; second tap clears flag and decrements flagsPlaced | Pass |
| Mine hit decrements lives | Tap a cell containing a mine (lives=2) | lives decrements to 1, cell.exploded=true, 'crash' sound plays; game remains in PLAYING state | Pass |
| Win condition triggers winFlash | Reveal the last safe cell (revealedCount reaches numSafe=68) | winBoard() called: 'gem' sound plays, flashTimer set to 0.8, win bonus score added, then initBoard() resets the board | Pass |
| Score formula on board clear | Clear a board in 60 seconds | score increases by numSafe*3 + max(0,300-floor(60*2)) = 204 + max(0,300-120) = 204+180 = 384 points, plus 5 per dig reveal during the board | Pass |

## Performance Notes

**80-cell grid render:** The grid is 8x10 = 80 cells. Each frame, `draw()` iterates all 80 cells to render their state. This is a trivially small workload for canvas2D and poses no performance concern at 60fps.

**Flood fill recursion depth:** `floodReveal()` is a recursive DFS. The maximum recursion depth in the worst case is 80 (all cells connected with zero adjacency and no mines). This is well within JavaScript's default call stack limit (~10,000 frames) and will not cause a stack overflow. On a 12-mine board the practical recursion depth is significantly lower.

**Timer accuracy:** `elapsedTime` is driven by the game loop `dt` accumulator. At 60fps each frame adds ~16.7ms. The time bonus formula uses `floor(elapsedTime * 2)` which changes every 0.5 seconds, giving reasonable granularity without needing high-precision timers.

## Edge Cases

**150ms debounce preventing double-tap:**
Rapid double-taps (e.g., an accidental bounce from a physical tap) within 150ms of the previous tap are ignored. This prevents a single physical tap from triggering two reveals in succession, which is especially important near mines. The debounce is enforced by comparing the current timestamp against `lastTapTime` at the start of `tap()`.

**lives=0 exact boundary:**
`hitMine()` decrements lives before checking if lives<=0. The exact boundary — hitting a mine when lives is exactly 1 — must decrement to 0 and trigger the death sequence (`gameplayStop()`, `onRunEnd()`, `showInterstitial()`, play 'lose' sound, transition to DEAD). Lives should never go negative; the check must be `<=0` not `===0` to be safe against any unexpected double-call scenario.

**Flagging all mines without revealing:**
A player can place flags on all 12 mines and never reveal a single safe cell. `winBoard()` is triggered by `revealedCount >= numSafe`, not by flags. Placing all flags does not win the board; the player must still reveal all 68 safe cells. `flagsPlaced` is tracked for HUD display but has no win-condition logic attached to it.

**Flagged cell reveal protection:**
Tapping a flagged cell in dig mode should be a no-op to prevent accidental reveals of cells the player has deliberately marked. This is a standard Minesweeper protection — verify that `tap()` checks `cell.flagged` before revealing in dig mode.

**winFlash timer during update:**
If `update(dt)` is not called (e.g., tab is backgrounded), `flashTimer` will not count down and `initBoard()` will be delayed. This is acceptable behavior as the game is paused when not visible.
