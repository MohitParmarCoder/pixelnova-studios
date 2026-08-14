# Card-Pairs (Blackjack 21) — Test Report

## Test Scope

Manual and logic-level tests covering state transitions, card mechanics, chip accounting, and ad/audio integration hooks.

## State Transition Tests

| Test | Expected | Status |
|---|---|---|
| MENU tap starts game | State → PLAYING, `chips=100`, `lives=3` | Pass |
| `chips <= 0` ends game | State → DEAD | Pass |
| `lives === 0` ends game | State → DEAD | Pass |
| `chips >= 200` triggers win | Win game flow triggered | Pass |
| DEAD tap restarts | `showInterstitial()` called, then `startGame()` | Pass |

## Round Phase Tests

| Test | Expected | Status |
|---|---|---|
| HIT (left half tap) in PLAYER phase | Card added to `playerHand` | Pass |
| STAND (right half tap) in PLAYER phase | Phase → DEALER | Pass |
| Player reaches 21 | Auto-stand triggered, phase → DEALER | Pass |
| Player busts (> 21) | Phase → RESULT, `resultMsg` shows bust | Pass |
| Dealer draws to 17+ | Dealer stops drawing at value >= 17 | Pass |
| Dealer busts | Player wins, `chips += 10` | Pass |
| Push (equal values) | `chips` unchanged, `lives` unchanged | Pass |
| RESULT timer expires (2.2s) | New round begins automatically | Pass |

## Ace Logic Tests

| Hand | Expected Value | Status |
|---|---|---|
| A + 5 | 16 (Ace = 11) | Pass |
| A + 10 | 21 (Ace = 11) | Pass |
| A + 10 + 5 | 16 (Ace reduced to 1) | Pass |
| A + A | 12 (one Ace = 11, one = 1) | Pass |
| A + A + 9 | 21 (both reduced appropriately) | Pass |
| A + 9 + 5 | 15 (Ace = 1 after reduction) | Pass |

## Chip Accounting Tests

| Scenario | Start | Expected End | Status |
|---|---|---|---|
| Win round | 100 chips | 110 chips | Pass |
| Lose round | 100 chips | 90 chips, lives-- | Pass |
| Push | 100 chips | 100 chips | Pass |
| Lose with 10 chips | 10 chips | 0 chips → DEAD | Pass |
| Win to 200 | 190 chips | 200 chips → win | Pass |

## Input Zone Tests

| Tap Location | Expected Action | Status |
|---|---|---|
| x < VW/2, y > 520 (PLAYER phase) | HIT | Pass |
| x >= VW/2, y > 520 (PLAYER phase) | STAND | Pass |
| Tap during DEALER phase | No action | Pass |
| Tap during RESULT phase | No action | Pass |
| Tap during DEAD | Interstitial + restart | Pass |

## Audio Tests

| Event | Expected Sound | Status |
|---|---|---|
| Player HIT | `'gem'` | Pass |
| Win round | `'gem'` | Pass |
| Bust / lose | `'crash'` | Pass |
| Game start / STAND | `'tap'` | Pass |
| Game end | `'lose'` | Pass |

## Ad Integration Tests

| Call | Trigger | Status |
|---|---|---|
| `gameplayStart()` | `startGame()` called | Pass |
| `gameplayStop()` | `endGame()` called | Pass |
| `onRunEnd()` | `endGame()` called | Pass |
| `showInterstitial()` | Tap on DEAD | Pass |
| `offerDoubleScore(chips, 'cardpairs_best')` | Tap on DEAD | Pass |

## localStorage Tests

| Test | Expected | Status |
|---|---|---|
| Best score saved | `cardpairs_best` written when chips > previous best | Pass |
| Best score loaded | `_best` initialised from `cardpairs_best` on load | Pass |
| No existing key | `_best` defaults to 0 | Pass |

## Known Issues / Edge Cases

- **Mislabelled game name**: The global `CardPairs` and key `cardpairs_best` suggest a different game concept than Blackjack. No functional bug, but misleading.
- **No tutorial validation**: Players unfamiliar with Blackjack have no in-game guidance. Not a code defect.
- **Dealer hidden card**: No test currently validates that `dealerHidden` is always `true` at start of PLAYER phase and `false` during DEALER phase. Recommend adding explicit assertion.
- **resultTimer drift**: `resultTimer` uses frame-delta decrement; at very low frame rates, a single frame could skip the 2.2s threshold. Recommend clamping dt.
