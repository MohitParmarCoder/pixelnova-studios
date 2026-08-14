# Word Blitz — Codebase Reference

## Overview
Word Blitz is a word-spelling arcade game. A 3-letter target word is shown; 12 lettered bubbles float on screen. The player must tap the letters of the target word in order before a countdown timer expires. The global namespace is `WordBlitz` and the entire game logic is contained in `js/game.js`.

## File: js/game.js
- **Global namespace:** `WordBlitz`
- **Canvas size:** 390×844 virtual px

## State Machine
```
MENU → PLAYING → DEAD
```

## Core Variables

| Variable | Description |
|---|---|
| `score` | Number of words successfully spelled |
| `lives` | Remaining lives (starts at 3) |
| `targetWord` | Current 3-letter word to spell (from WORDS array) |
| `bubbles` | Array of letter bubbles; each has `{x,y,r,letter,color,hit}` |
| `progress` | Letters tapped so far in current word (0–2) |
| `timer` | Countdown timer for current round |
| `timerMax` | Starting timer value: `max(8, 15 - score*0.3)` |
| `best` | All-time best score (from localStorage `wordblitz_best`) |

## Key Functions
- `init(canvas, bestScore)` — Sets canvas, seeds best.
- `startGame()` — score=0, lives=3, calls `newRound()`.
- `newRound()` — Picks a random word from WORDS; creates pool of 9 distractors (distinct from word letters — PR #22 fix ensures no A–I always) plus word letters shuffled into 12 bubbles.
- `update(dt)` — Decrements timer; on timeout loses a life or resets round. Bubbles sway sinusoidally.
- `draw()` — Dark gradient background, floating colored letter bubbles, target word display at top, timer bar, HUD.
- `tap(x, y)` — Checks tap against bubble positions; if correct next letter in sequence, marks bubble `hit=true` and advances `progress`. Wrong letter: visual flash but no penalty. Complete word: `score++`, `newRound()`.

## Difficulty Scaling
`timerMax = max(8, 15 - score * 0.3)` — timer shrinks by 0.3s per point, bottoms out at 8s.

## PR #22 Fix — Distractor Diversity
Distractors were previously drawn from 'A'–'I' only. Fixed to draw from full alphabet minus word letters:
```js
var pool = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(
  function(l){ return targetWord.indexOf(l) === -1; });
```

## localStorage Keys
| Key | Content |
|---|---|
| `wordblitz_best` | Highest score achieved |

## Ad Integration Points
| Event | AdManager Call |
|---|---|
| Game start | `AdManager.gameplayStart()` |
| Game over | `AdManager.gameplayStop()` + `onRunEnd()` |
| Between runs | `AdManager.showInterstitial()` |
| DEAD screen | `AdManager.offerDoubleScore(score, 'wordblitz_best')` |
