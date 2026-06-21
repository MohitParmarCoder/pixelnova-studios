# Card-Pairs (Blackjack 21) — Codebase Reference

## Overview

Global: `CardPairs`. ~516 lines. Single-file HTML5 canvas game. Despite the name "CardPairs", this is a Blackjack 21 game. No build step, no dependencies.

## State Machine

```
MENU → PLAYING → DEAD
```

- **MENU**: Title screen, tap to start.
- **PLAYING**: Active blackjack round. Sub-phases controlled by `roundPhase`.
- **DEAD**: Game over (chips <= 0). Tap triggers interstitial then restart.

## Key Variables

| Variable | Initial Value | Description |
|---|---|---|
| `score` | 100 | Alias for `chips`; used as the tracked score |
| `chips` | 100 | Player's chip count |
| `_best` | localStorage | Highest chip count ever reached |
| `BET` | 10 | Fixed bet per round |
| `lives` | 3 | Lives remaining; lost on each losing round |
| `playerHand` | `[]` | Array of card objects in player's hand |
| `dealerHand` | `[]` | Array of card objects in dealer's hand |
| `dealerHidden` | `true` | Whether dealer's first card is face-down |
| `roundPhase` | `'PLAYER'` | `'PLAYER'`, `'DEALER'`, or `'RESULT'` |
| `resultMsg` | `''` | Win/lose/push message string |
| `resultTimer` | 2.2 | Countdown timer for RESULT phase (seconds) |
| `t` | 0 | Animation time accumulator |

## Round Phases

- **PLAYER**: Player taps HIT (left half, y > 520) or STAND (right half, y > 520). Auto-stands on 21.
- **DEALER**: Dealer draws cards until hand value >= 17. `dealerHidden` set to `false`.
- **RESULT**: `resultMsg` shown for 2.2 s (`resultTimer`), then new round begins automatically.

## Core Mechanics

### Blackjack Rules
- Standard blackjack: beat dealer without exceeding 21.
- Aces count as 11; automatically reduced by 10 if hand would bust.
- Player taps left half of screen (below y=520) to HIT, right half to STAND.
- Auto-stand triggered when player reaches exactly 21.

### Win/Loss Conditions
- **Win**: `chips += 10` (gain BET).
- **Lose**: `chips -= 10` (lose BET), `lives--`.
- **Push** (tie): No change to chips or lives.
- **Win game**: `chips >= 200`.
- **Game over**: `chips <= 0` or `lives === 0`.

### Ace Logic
Aces initially count as 11. If total > 21 and an ace exists at value 11, it is reduced to 1. This is recalculated on every card add.

## Card Representation

- `val`: Numeric value string (A, 2–10, J, Q, K).
- `suit`: `'S'`, `'H'`, `'D'`, `'C'` (Spades, Hearts, Diamonds, Clubs).
- Hearts and Diamonds render in red; Spades and Clubs render in white/light color.

## Input Handling

All input via tap/click. During `PLAYING` + `roundPhase === 'PLAYER'`:
- `x < VW/2` and `y > 520` → HIT
- `x >= VW/2` and `y > 520` → STAND

During `DEAD`:
- Tap → `showInterstitial()` then `startGame()` + `offerDoubleScore(chips, 'cardpairs_best')`

## Audio Cues

| Event | Sound |
|---|---|
| HIT card drawn | `'gem'` |
| Win round | `'gem'` |
| Bust / lose round | `'crash'` |
| Start game / STAND | `'tap'` |
| Game end (dead) | `'lose'` |

## Ad Integration

| Call | Trigger |
|---|---|
| `gameplayStart()` | Inside `startGame()` |
| `gameplayStop()` + `onRunEnd()` | Inside `endGame()` |
| `showInterstitial()` | Tap on DEAD state |
| `offerDoubleScore(chips, 'cardpairs_best')` | Tap on DEAD state |

## localStorage

| Key | Value |
|---|---|
| `cardpairs_best` | Highest chip count reached across all sessions |

## Rendering Notes

- Canvas is virtual 390×844, letterboxed via CSS scaling.
- Cards drawn as rounded rectangles with suit symbol and value text.
- Dealer's first card shown as face-down (blank) while `dealerHidden === true`.
- `t` increments each frame for smooth animations (card slide-in, chip counter pulse).
