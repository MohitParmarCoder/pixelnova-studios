# Arrow Dodge — Usability Report

## Overview
Arrow Dodge is a one-touch tap-to-fire arcade game designed for portrait mobile play. The core interaction is simple: tap anywhere on screen to fire an arrow toward that point, with the goal of hitting falling bullseye targets before they reach the bottom.

## Controls
| Input | Action |
|---|---|
| Tap anywhere | Fire arrow toward tap point (subject to `COOLDOWN_MAX = 0.5s`) |
| Tap on MENU | Start game |
| Tap on DEAD | Interact with end-of-run ad / double-score offer |

## HUD Elements
- **Score** — displayed top-center during `PLAYING`.
- **Lives** — 3 heart/icon indicators; one removed on each `loseLife()` call.
- **Wind indicator** — visual cue showing current `wind` value and direction; essential for player adaptation.
- **Flash** — full-screen flash driven by `flashTimer` on each life loss; communicates damage without interrupting play.

## Readability Strengths
- Archer position is fixed at `(VW/2, 760)` — bottom-center, always visible, never occluded by targets.
- 3 visually distinct colored bullseyes are immediately readable against the star-field background.
- Score increase uses per-hit scoring (`max(5, floor(distToArcher/30))`) that rewards long-distance shots, giving players meaningful feedback on skill.

## Usability Concerns

### Cooldown Opacity
The 0.5s fire cooldown (`COOLDOWN_MAX`) is not visually communicated by a cooldown bar or animation. Players firing rapidly may be confused by missed taps during the locked-out window.

**Recommendation:** Add a visual fill arc or color pulse on the archer sprite when cooldown is active.

### Wind Legibility
Wind force grows significantly at higher tiers — up to `(random-0.5)*115` at `score=150`. Without a labeled numeric readout, experienced players cannot precisely gauge compensation angle.

**Recommendation:** Display a numeric wind value (e.g., `"Wind: +23"`) alongside the directional indicator.

### Lives vs. Score Feedback
Life loss triggers a flash and plays `'crash'`, but there is no distinct animation separating the moment of impact from the penalty. At high target density this can feel unpredictable.

**Recommendation:** Brief target-blink or explosion particle effect at the point a target exits the bottom edge.

### First-Time Player Onboarding
There is no tutorial or in-game instruction overlay. New players must discover the wind mechanic through trial and error.

**Recommendation:** Add a single first-run tooltip: "Tap to fire — watch the wind!"

## Accessibility Notes
- Game is fully one-handed, portrait, thumb-reachable.
- Archer is fixed at screen bottom — no need to track a moving player sprite.
- Background stars (60 objects) provide visual depth without interfering with target readability.
- No color-blind accommodation for the 3 target colors; consider adding shape differentiation to bullseye rings.

## Performance Notes
- 60 background stars drawn each frame — low GPU cost on canvas2d.
- 3 simultaneous targets and a variable number of in-flight arrows; no pooling required at this scale.
- `cooldown` timer prevents arrow spam that could degrade frame rate.
