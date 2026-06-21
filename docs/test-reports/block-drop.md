# Block Drop — Test Report

## Static Analysis Findings

| Property | Finding |
|---|---|
| Global exposure | Single global `BlockDrop`; no namespace pollution beyond shared modules (Audio, AdManager, Input) |
| Line count | ~712 lines — the largest of the three games in this repository |
| Build step | None; plain `<script>` inclusion, suitable for syntax-check via `node --check` |
| Module pattern | IIFE; internal functions are not directly unit-testable without test hooks |
| Public API | `BlockDrop.getState()`, `BlockDrop.getScore()` assumed as test hooks consistent with Orbit Hopper pattern |
| Dead code risk | `dropFast` flag is set during instant-drop but should be verified as cleared on `spawnPiece()` to avoid carry-over state |
| Magic numbers | `GRID_X=20`, `GRID_Y=120`, flash duration `0.18` are inline constants; recommend named constants for maintainability |

## Functional Test Cases

| Test Case | Input | Expected | Status |
|---|---|---|---|
| Left zone tap moves piece left | Tap at x=80 (< 130) during PLAYING | `piece.col` decrements by 1; 'tap' audio fires | Not run |
| Center zone tap instant-drops | Tap at x=195 (130–260) during PLAYING | Piece teleports to `ghostRow()`; 'crash' audio fires; `dropFast=true` | Not run |
| Row clear triggers flash | Fill all 7 cells in any row | `flashRows` populated; affected row renders white for 0.18 s; row removed after timer | Not run |
| Level increments at 5 rows cleared | Clear 5 rows cumulatively | `level` becomes 2; `fallInterval` recalculates to 0.75 s | Not run |
| Spawn collision ends game | Fill grid such that spawn position is occupied | `spawnPiece()` detects collision; state transitions to `DEAD`; 'lose' audio fires | Not run |
| Ghost preview position accuracy | Active piece at col 3, clear path to bottom | Ghost row index equals lowest unoccupied row in column range; ghost renders at correct position | Not run |

## Performance Notes

- **Star background:** 80 stars are drawn each frame. Each star is a simple fillRect or arc call; overhead is negligible at 60 fps.
- **Flash animation:** The 0.18 s flash iterates over `flashRows` each frame to overdraw completed rows in white. With a maximum of 14 rows possible per flash, this is a small fixed-cost loop.
- **Grid rendering:** 14 x 7 = 98 cells rendered each frame; each filled or empty cell requires one canvas draw call. Total draw call count per frame is bounded and small.
- **No image assets:** All rendering is canvas2D primitives, eliminating texture upload and image decode costs.
- **Recommendation:** Profile `finishClear()` on multi-row shifts to confirm the splice-and-unshift grid mutation does not stutter on low-end devices, especially when clearing 4+ rows simultaneously.

## Edge Cases

**Simultaneous multi-row clear:**
If a piece completes more than one row at once, all completed rows should be added to `flashRows` in a single pass, flashed together, and removed together. The score increment `n*10` (where n = number of cleared rows) must apply the full batch count, not process rows individually. Verify that `finishClear()` handles non-contiguous completed rows correctly when rows above and below an incomplete row are both full.

**Piece spawning into a full column:**
When the grid is near-full, a newly spawned piece may overlap occupied cells at the top of the grid. The spawn collision check in `spawnPiece()` must verify all cells of the new piece's bounding box, including multi-cell shapes (1x2, 1x3, 2x2). A 2x2 piece spawning with one cell clear and one occupied should still trigger `endGame()`.

**Level cap behavior:**
`fallSpeed()` floors at 0.15 s/cell. Once `rowsCleared` is high enough that the formula would produce a value below 0.15, the level counter (`floor(rowsCleared/5)+1`) continues incrementing but `fallInterval` stays constant. Verify the HUD level display continues to update correctly at high row counts even after the speed cap is reached, and confirm no integer overflow or display truncation occurs at extreme scores.
