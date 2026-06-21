# Codebase Documentation: Coin Catch

## Overview

Global: `CoinCatch`. Approximately 160 lines of vanilla JS + Canvas2D. No dependencies, no build step.

## State Machine

```
MENU → PLAYING → DEAD
```

- **MENU**: Title screen with start prompt.
- **PLAYING**: Active gameplay; coins fall, basket tracks input.
- **DEAD**: Game over; shows final score, best, and ad flow.

## Key Variables

| Variable | Initial Value | Description |
|---|---|---|
| `score` | 0 | Current run score |
| `best` | localStorage | All-time best score |
| `lives` | 3 | Remaining lives; miss a coin → lives-- |
| `coins` | [] | Array of active falling coin objects |
| `particles` | [] | Visual burst particles on catch/miss |
| `spawnTimer` | 0 | Countdown to next coin spawn |
| `spawnInterval` | 1.2s | Time between spawns; decreases with score |
| `speed` | 160 | Coin fall speed in px/s |
| `basket.x` | 195 | Basket center x (lerp target) |
| `basket.w` | 70 | Basket width in px |
| `basket.h` | 22 | Basket height in px |
| `basket.y` | VH-80 | Basket vertical position |
| `dragX` | null | Current touch/pointer x; null when not dragging |

## Coin Types

| Type | Radius | Points | Color |
|---|---|---|---|
| Gold | r=14 | +1 | Gold |
| Silver | r=12 | +2 | Silver |
| Cyan | r=10 | +3 | Cyan |

Coin type is chosen randomly at spawn. Each coin tracks a `spin` value incremented at `dt*2` per frame, drawn as a rotated ellipse to simulate spinning.

## Core Mechanics

### Basket Movement
```
basket.x += (dragX - basket.x) * 0.25
```
Smooth lerp follows the active drag position. When `dragX` is null (no active touch), the basket stays in place.

### Catch Detection
Coin caught when:
- Coin `y` overlaps the basket band (vertical overlap)
- `|coin.x - basket.x| < basket.w/2 + coin.r`

On catch: `score += pts`, spawn particles, play `gem` audio.

### Miss Detection
Coin missed when `coin.y > VH + 20`. On miss:
- `lives--`
- Grace period: `spawnTimer = -0.6` (600 ms delay before next coin)
- Play `crash` audio

### Difficulty Scaling
- `speed = 160 + score * 2.5`
- `spawnInterval = max(0.4, 1.2 - score * 0.01)`

## HUD

- Top-left: `'Score: N'`
- Top-right: Heart icons (3 max)
- Background: Dark purple radial gradient

## Audio

| Event | Sound |
|---|---|
| Catch | `gem` |
| Miss | `crash` |

## Ad Integration

| Trigger | Call |
|---|---|
| Game start | `gameplayStart()` |
| Game over | `gameplayStop()`, `onRunEnd()`, `showInterstitial()` |
| Score doubling | `offerDoubleScore(score, 'coincatch_best')` |

## localStorage

| Key | Value |
|---|---|
| `coincatch_best` | Highest score achieved |

## File Location

Single self-contained JS file. Entry point is `CoinCatch` global object with `init()`, `update(dt)`, and `draw(ctx)` methods called from the shared game loop.
