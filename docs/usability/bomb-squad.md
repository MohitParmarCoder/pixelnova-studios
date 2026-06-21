# Bomb Squad — Usability Report

## Controls

| Action | Method |
|---|---|
| Reveal a cell | Tap the cell while in dig mode (default) |
| Place / remove a flag | Tap the cell while in flag mode |
| Toggle flag mode | Tap the flag mode button at the bottom of the screen |
| Start game | Tap anywhere on the MENU screen |
| Restart after death | Tap anywhere on the DEAD screen |

**Debounce:** A 150ms debounce on `lastTapTime` prevents double-tap accidental inputs. Taps within 150ms of the previous tap are silently ignored.

## Learning Curve

**Minesweeper familiarity:** Players who already know Minesweeper will be immediately comfortable. The 8x10 grid, numbered adjacency cues, and mine-avoidance objective are genre-standard.

**Flag mode UX:** Unlike desktop Minesweeper (where right-click flags a cell), Bomb Squad requires the player to toggle a flag mode button before tapping a cell. This is a necessary adaptation for touchscreens but requires the player to consciously switch modes, adding a mode-switching cognitive load.

**Number adjacency cues:** Each revealed cell shows its adjacent mine count (1–8) or is blank when zero. Zero-adjacency cells trigger automatic flood reveal, which can open large portions of the board at once. New players may find this surprising but it is standard to the genre.

**First-tap safety:** The first tap on each new board is always safe, removing the frustrating "instant death on first move" problem common in naive Minesweeper implementations. This is not communicated explicitly to the player.

## Visual Feedback

| Feedback | Implementation |
|---|---|
| Win flash | `winFlash` effect plays for 0.8 seconds when all safe cells are revealed, providing a clear board-clear signal before the new board initializes |
| Exploded cell | The mine cell that was hit is marked with `exploded=true` and rendered with a distinct highlight to show which cell caused the hit |
| All mines revealed on death | When lives reach 0, the DEAD state reveals the location of all mines on the board, giving the player post-mortem information |
| Flag icons | Flagged cells show a flag icon drawn in canvas, clearly distinguishing them from unrevealed and revealed cells |
| Lives HUD | Remaining lives are displayed in the HUD at all times during PLAYING |

## Accessibility Notes

- **Number-based adjacency:** Adjacent mine counts are displayed as numerals, which benefits players who can read numbers but may be insufficient for players with cognitive disabilities who rely on color alone.
- **Color reliance:** Mine cells, safe cells, flagged cells, and revealed cells are distinguished primarily by color and icon. Players with color vision deficiency (particularly red-green) may have difficulty distinguishing mine indicators from safe cell backgrounds.
- **No audio-only cues:** Sounds (`tap`, `crash`, `gem`, `lose`) reinforce visual events but do not carry unique information — the game is fully playable with sound off.
- **No screen reader support:** Canvas-based rendering provides no accessible DOM tree. The game is not accessible to screen reader users.
- **No adjustable text size:** All numerals are rendered at a fixed canvas size.

## Mobile UX

- **Cell dimensions:** Each cell is 42x44 pixels, which is near the minimum recommended touch target size (44x44 px per Apple HIG). On small-screen phones (under 375px wide), cells may feel tight and increase mis-tap frequency.
- **Grid layout:** The 8-column grid at 42px per cell spans 336px, fitting within a 390px virtual canvas width with 27px side margin (GX=27), leaving 27px on each side.
- **Flag mode toggle:** Located at the bottom of the screen, reachable with the thumb in one-handed play. However, mode-switching requires an extra tap every time the player wants to flag rather than dig.
- **Debounce:** The 150ms debounce is appropriate for touchscreens and prevents accidental double-reveals.

## UX Issues and Recommendations

**1. Flag mode discoverability**
The flag mode toggle button may not be obvious to first-time players. New players may not realize they need to switch modes to place flags and might tap mines by mistake. Recommendation: add a brief first-run tooltip or highlight the flag button with a pulsing animation on the first board.

**2. No long-press to flag**
Desktop Minesweeper uses right-click to flag; mobile equivalents typically use long-press. Bomb Squad requires a mode toggle instead. This doubles the taps needed to flag a cell (toggle mode, tap cell, toggle back). Recommendation: implement long-press (press-and-hold ~400ms) as a direct flag action without needing to switch modes.

**3. Cell size on small screens**
42x44px cells are borderline for tap accuracy on phones narrower than 375px. A mis-tap that hits a mine wastes a life through no fault of gameplay skill. Recommendation: scale the canvas or grid layout to the device screen, or increase cell padding on smaller viewports.

**4. No undo**
There is no undo for accidental reveals or mis-flags. A single mis-tap can cost a life. Given the 150ms debounce already exists, recommendation: consider allowing a single-step undo of the most recent action.

**5. First-tap safety is not communicated**
The first-tap safe mechanic is a quality-of-life feature that players may not know about. Recommendation: add a brief "First tap is always safe!" hint on the MENU screen or at the top of the first board.

**6. No difficulty selection**
All sessions use the same 12 mines on an 8x10 grid. Experienced Minesweeper players will find this too easy after a few boards; new players may find 12 mines daunting. Recommendation: offer Easy (8 mines), Medium (12 mines), and Hard (16 mines) options on the MENU screen.
