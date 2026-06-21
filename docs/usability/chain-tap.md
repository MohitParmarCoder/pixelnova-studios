# Chain Tap — Usability Report

## Game Identity

- **Display name**: Chain Tap
- **Genre**: Number sequencing / cognitive reflex
- **Session length**: 1–3 minutes per run

## Core Loop Clarity

### What the player must do
Tap numbered circles in order (1, 2, 3 … up to `n`) before the timer runs out. Circles are scattered randomly across the canvas each round.

### What communicates this
- The `'Tap: N →'` label constantly shows the current target number `nextNum`
- The active (next-to-tap) circle is visually distinguished with a dashed ring
- Each circle displays its number prominently inside

## Feedback Quality

| Action | Immediate Feedback |
|---|---|
| Correct tap | Circle dims / marks tapped; `'tap'` sound |
| Wrong tap | `'crash'` sound; life indicator decrements |
| Round complete | `'gem'` sound; brief 500 ms delay before next round |
| Timer expires | `'lose'` sound; lives decrease |

## Timer UX

- Bar spans the bottom of the canvas
- Color gradient: green (>50%) → yellow (25–50%) → red (<25%)
- Starting time decreases with rounds: `max(8, 20 - round)` seconds, creating escalating pressure

## Difficulty Curve

| Round | Circles | Timer |
|---|---|---|
| 1 | 6 | 19 s |
| 5 | 10 | 15 s |
| 8+ | 12 | 12 s |
| 12+ | 12 | 8 s (minimum) |

The floor of 12 circles and 8 seconds creates a stable but demanding late-game loop.

## Friction Points

- **No pre-round preview**: circles appear and timer starts immediately; a 1–2 s preview pause before countdown would reduce first-tap errors
- **No wrong-tap indication on the circle itself**: only audio feedback distinguishes wrong taps; a brief red flash on the incorrect circle would help
- **Small touch target at r=32**: on small screens this may cause mis-taps between adjacent circles

## Accessibility Considerations

- Color-only timer feedback; no text label showing seconds remaining
- Dashed ring on active circle relies on thin line; could be thicker for low-vision players
- Audio cues are important for wrong-tap feedback — mute users lose that signal

## Strengths

- Concept is immediately understood: numbers → tap in order
- Escalating circle count and shrinking timer provide natural difficulty ramp
- Short rounds (complete or die quickly) keep sessions snappy
