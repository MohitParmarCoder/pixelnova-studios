# Codebase Documentation: Bunny Hop

## Overview

Global: `BunnyHop`. Approximately 360 lines of vanilla JS + Canvas2D. No dependencies, no build step.

## State Machine

```
MENU → PLAYING → DEAD
```

- **MENU**: Shows title, best score, tap-to-start prompt.
- **PLAYING**: Active game loop — physics, scrolling, platform/carrot generation.
- **DEAD**: Death screen with final score and double-score offer.

## Key Variables

| Variable | Type | Description |
|---|---|---|
| `best` | number | Persisted high score from `localStorage('bunnyhop_best')` |
| `score` | number | `scoreBase + carrotBonus` — displayed in-game |
| `scoreBase` | number | Derived from `scrollY / 50` (height climbed) |
| `carrotBonus` | number | +5 per carrot collected |
| `bx`, `by` | number | Bunny position (virtual canvas coords) |
| `bvx`, `bvy` | number | Bunny velocity (px/s) |
| `BW`, `BH` | const | Bunny dimensions: 30 x 36 px |
| `GRAVITY` | const | 1400 px/s² downward acceleration |
| `onPlatform` | boolean | Whether bunny is resting on a platform this frame |
| `scrollY` | number | Total upward distance scrolled (world units) |
| `platformSpeed` | number | Scroll speed; starts at 60, max 280 px/s |
| `platforms` | array | `{x, y, w}` objects — active platform list |
| `carrots` | array | `{x, y, collected}` objects |
| `PLAT_H` | const | Platform height: 14 px |
| `GEN_AHEAD` | const | Generate platforms this many px above camera top (950) |
| `worldTopY` | number | Y coordinate of the top of the visible world |

## Physics & Mechanics

### Input
- Tap left half of screen: `bvx = -180`
- Tap right half of screen: `bvx = 180`
- Tap also sets `bvy = -750` if `onPlatform` is true or `bvy > -200` (prevents double-jump mid-air at speed)

### Movement
- `GRAVITY` (1400) applied each frame: `bvy += GRAVITY * dt`
- Bunny wraps horizontally (exits right → enters left and vice versa)
- Camera tracks bunny, holding it at `VH * 0.35` from the top

### Scrolling
```
platformSpeed = min(280, 60 + scrollY * 0.015)
```
Speed increases gradually with height climbed.

### Platform Generation
Platforms spawn downward (in world space above the current camera view) until `GEN_AHEAD` px ahead of `worldTopY`. Platforms have randomized `x` and `w`.

### Death
Bunny falls off the bottom of the screen → `die()` is called. No lives system — one mistake ends the run.

### Scoring
```
score = scoreBase + carrotBonus
scoreBase = scrollY / 50
carrotBonus += 5  // per carrot collected
```

## Audio

| Event | Sound key |
|---|---|
| Land on platform | `'tap'` |
| Collect carrot | `'gem'` |
| Death | `'lose'` |

## Ad Integration

| Trigger | Call |
|---|---|
| MENU → PLAYING (first tap) | `gameplayStart()` |
| On death | `gameplayStop()`, `onRunEnd()`, `showInterstitial()` |
| Death screen | `offerDoubleScore(score, 'bunnyhop_best')` |

## localStorage

| Key | Value |
|---|---|
| `'bunnyhop_best'` | Highest score achieved |
