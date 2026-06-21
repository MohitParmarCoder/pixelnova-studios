# Asteroid Belt — Usability Report

## Overview
Asteroid Belt uses a drag-to-move control scheme where the player continuously steers a spaceship by dragging their finger. The ship smoothly follows the drag target using a lerp factor of `dx * min(1, dt*7)`. The game rewards spatial awareness and reflexes over twitch precision.

## Controls
| Input | Action |
|---|---|
| Drag / hold and move | Move spaceship toward pointer position |
| Tap on MENU | Start game |
| Tap on DEAD | Interact with end-of-run ad / double-score offer |

## HUD Elements
- **Score** — crystal count shown top-center during `PLAYING`.
- **Lives** — 3 indicators; one removed per asteroid hit.
- **Flash** — full-screen flash on life loss (driven by `flashTimer`).

## Readability Strengths
- Drag-to-move is a natural, low-friction control for mobile; no discrete tap-aim required.
- Ship smoothing (`min(1, dt*7)`) prevents jitter while keeping response time low.
- 100 background stars provide strong depth cue and make the ship/asteroid layer clearly readable.
- Crystals spawn with a distinct visual appearance and are collected within `r=14px` — a forgiving hitbox that rewards active positioning without requiring pixel precision.

## Usability Concerns

### Crystal Spawn Overlap with Asteroids
Crystals spawn at random positions. At higher `tick` values when asteroid density is high, a crystal may appear in an impassable cluster, making it unreachable without taking a hit.

**Recommendation:** When spawning a crystal via `spawnCrystal()`, check that no asteroid is within a safety radius (e.g., 60px) of the spawn point.

### No Visual Speed Feedback
As `tick` grows, asteroids move faster and spawn more frequently. The player has no indicator that difficulty is escalating until they notice the speed change.

**Recommendation:** Add a subtle "wave" label or speed shimmer at discrete difficulty milestones (e.g., every 15 seconds).

### Ship Occlusion by Finger
On a touchscreen, the player's finger covers the ship during drag. Since the ship precisely follows the drag point, the player cannot see the ship sprite while steering.

**Recommendation:** Apply a small offset so the ship renders slightly above the pointer position (e.g., `playerY - 30`) to keep it visible below the fingertip.

### No Respawn Invincibility
After losing a life, the player is immediately vulnerable to subsequent asteroid hits. With 5+ simultaneous asteroids at high `tick`, rapid consecutive life loss is possible.

**Recommendation:** Add a brief invincibility window (e.g., 1.5s) after each `loseLife()` call, indicated by a blinking ship sprite.

## Accessibility Notes
- Continuous drag is more fatigue-inducing than tap-only controls on long sessions.
- 100 star background is purely decorative and does not interfere with gameplay objects.
- Crystal collection radius of 14px is accessible; does not require hairline precision.
- No text shown during PLAYING other than score — suitable for non-English speakers.

## Performance Notes
- 100 stars drawn per frame — low cost on canvas2d.
- Asteroid array grows until off-screen objects are culled; verify culling occurs to prevent unbounded array growth at very high `tick` values.
- Ship smoothing uses `min(1, dt*7)` — capped at 1 to prevent overshoot on long frames.
