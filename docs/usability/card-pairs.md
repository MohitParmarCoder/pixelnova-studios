# Card-Pairs (Blackjack 21) — Usability Report

## Player Experience Overview

Card-Pairs is a simplified Blackjack 21 game using a chip-based progression system. The core loop is one-handed tap play: tap left half to HIT, right half to STAND.

## Controls

| Action | Input |
|---|---|
| HIT (draw card) | Tap left half of screen, below y=520 |
| STAND (end turn) | Tap right half of screen, below y=520 |
| Start new game | Tap anywhere on DEAD screen |

### Usability Strengths
- Large tap zones (half the screen width each) minimise mis-taps.
- No drag or swipe required; fully single-tap.
- Auto-stand on 21 removes a redundant player action.
- 2.2-second RESULT phase gives time to read the outcome before the next round starts automatically.

### Usability Weaknesses
- The game name "card-pairs" does not communicate Blackjack; new players may expect a matching/memory game.
- No visual tap zone indicators (no HIT/STAND labels visible during PLAYER phase), relying on player prior knowledge of control layout.
- Fixed BET of 10 chips per round; no option to adjust.
- Dealer hidden card gives no visual mystery cue beyond a blank rectangle.

## Onboarding

- No tutorial or how-to-play screen.
- Players familiar with Blackjack will immediately understand, but new players have no in-game guidance.
- The chip counter starting at 100 and the goal of reaching 200 is not stated anywhere in the UI.

## Feedback Quality

| Moment | Feedback Provided |
|---|---|
| Win round | `resultMsg` overlay + `'gem'` sound |
| Lose round | `resultMsg` overlay + `'crash'` sound + life indicator updates |
| Bust | `resultMsg` showing bust + `'crash'` sound |
| Push | `resultMsg` overlay, no sound change |
| Game over | DEAD state, `'lose'` sound |
| Win game (chips >= 200) | Transitions to win state |

## Readability

- Cards use letter abbreviations for suits (S/H/D/C); internationally recognisable suit symbols would improve clarity.
- Hearts and Diamonds in red, Spades/Clubs in white — clear colour differentiation.
- Hand value totals should be prominently displayed at all times to help players make HIT/STAND decisions.

## Pacing

- Rounds are fast (typically 5–15 seconds each).
- The 2.2-second result pause prevents rounds from feeling too instant.
- With a fixed BET of 10 and a starting value of 100 chips, the minimum game length is 10 rounds (if losing every round); maximum is undefined.

## Accessibility

- No font size settings.
- Colour differentiation (red vs. white suits) may be difficult for red-green colour-blind players.
- Audio feedback is present but no visual-only fallback is explicitly designed.
- No pause functionality during a round.

## Recommended UX Improvements

1. Rename or subtitle the game to "Blackjack 21" to set correct expectations.
2. Add visible HIT / STAND button labels in the tap zone area.
3. Display the current hand value total prominently next to each hand.
4. Add a brief how-to-play overlay accessible from the MENU.
5. Consider a variable bet slider for session progression tension.
6. Add suit symbols (♠ ♥ ♦ ♣) in addition to or instead of S/H/D/C letters.
