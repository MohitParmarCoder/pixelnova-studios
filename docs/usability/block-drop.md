# Block Drop — Usability Report

## Controls

Block Drop uses a three-zone tap scheme mapped to horizontal screen regions on the canvas:

| Zone | X Range | Action |
|---|---|---|
| Left | x < 130 | Move active piece one column left |
| Center | 130 ≤ x ≤ 260 | Instant-drop piece to lowest valid row |
| Right | x > 260 | Move active piece one column right |

There is no swipe, drag, or hold input. Every interaction is a discrete tap. On desktop, mouse clicks map to the same zones.

## Learning Curve

Players familiar with Tetris understand the core loop immediately: pieces fall, fill rows, rows disappear. The zone-based control scheme diverges from the standard left/right arrow + down arrow mental model, which requires a short adjustment period.

The HUD panel labels tap zones with color indicators so first-time players can orient themselves without reading instructions. The ghost piece (a faded outline of where the current piece will land) provides the key spatial cue that removes guesswork from instant-drop timing. Level and row count are visible at all times, giving players a concrete target to pursue.

Shapes are simpler than standard Tetris (no L, T, S, Z tetrominoes; no rotation), which reduces cognitive load and makes the game approachable for casual players.

## Visual Feedback

| Element | Trigger | Feedback |
|---|---|---|
| Ghost piece | Always during PLAYING | Faded outline at landing position |
| Row flash | Row(s) completed | Affected rows turn white for 0.18 s before removal |
| Score increment | Row cleared | Score updates immediately after flash resolves |
| Star background | Always | 80 stars provide depth and visual interest without distracting from the grid |
| HUD panel | Always during PLAYING | Right-side panel shows score, best, and level in real time |
| Instant-drop indicator | Center zone tap | 'crash' audio cue fires; piece teleports; dropFast flag triggers any visual distinction |

## Accessibility Notes

- **Color-only piece distinction:** The 5 piece colors (red, blue, green, yellow, magenta) are the sole differentiator between piece types. There is no shape or pattern variation between pieces of different colors. Users with red-green or other color vision deficiencies may not be able to distinguish all piece types reliably.
- **Zone color indicators:** Tap zones are marked with colored on-screen cues rather than text labels, which means players who cannot distinguish the zone colors receive no fallback label.
- **No text during gameplay:** The HUD uses numerals only during PLAYING/DEAD states, which is good for internationalization but means critical UI (zone labels) must rely entirely on visual color coding.
- **No audio captions or haptics:** Sound effects (tap, gem, crash, lose) carry gameplay information with no visual or haptic alternative for muted or hearing-impaired players.
- **Canvas scaling:** The virtual canvas is letterboxed to fit the device screen. Touch targets are derived from virtual coordinates, so physical tap target sizes vary with device size and could become small on narrow screens.

## Mobile UX

The zone-based control scheme is well-suited to one-handed portrait play: the left thumb naturally covers the left zone, and the center zone (130–260 px virtual) is reachable with a thumb sweep. There is no precision requirement — any tap within the zone registers, unlike drag-based or swipe-based controls that require directional accuracy.

The lack of a hold mechanic and the absence of rotation means players never need to perform multi-gesture sequences. This keeps the interaction model simple for touchscreen users.

Canvas letterboxing ensures the game renders correctly across device sizes without dedicated responsive layout work.

## UX Issues and Recommendations

**Issue 1: Center zone instant-drop is too easily triggered.**
The center zone (130–260 px) sits between the two move zones with no dead zone or confirmation gesture. Accidental center taps during rapid left/right movement instantly drop the piece, often ending the run prematurely. Recommendation: require a hold or double-tap for instant drop, or introduce a short delay before the drop executes.

**Issue 2: No piece rotation.**
All 5 shape types are fixed orientation. A 1x3 vertical piece cannot be rotated to 3x1 horizontal, eliminating a fundamental Tetris strategy. This limits scoring ceiling and makes the game feel incomplete to Tetris-literate players. Recommendation: add a fourth zone (or long-press) for 90-degree clockwise rotation.

**Issue 3: Zone boundaries are not visually persistent during gameplay.**
Zone indicators appear in the HUD area but the grid itself has no overlay lines showing where left, center, and right zones begin and end. Players who misremember the boundary coordinates will misfire inputs without obvious feedback explaining what went wrong. Recommendation: draw faint vertical lines on the canvas at x=130 and x=260, or shade the zone regions with low-opacity color fills behind the grid.

**Issue 4: No soft-drop option.**
The only downward controls are the natural fall speed and full instant-drop. There is no way to nudge a piece down one row at a time for fine positioning, a control that experienced Tetris players rely on heavily. Recommendation: add a soft-drop zone or hold-center gesture that accelerates fall speed without teleporting the piece.
