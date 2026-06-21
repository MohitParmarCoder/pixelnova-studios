# Codebase Overview — PixelNova Studios Game Portfolio

## Repository Structure

```
Udemy-react-fullstack-dailynews-project/
├── games/                    # 100 HTML5 mini-games
│   └── {game-name}/
│       ├── index.html
│       └── js/
│           ├── game.js       # Main game logic (~200–500 lines each)
│           ├── main.js       # Bootstrap + rAF loop
│           ├── audio.js      # ZzFX sound engine
│           └── ads.js        # AdManager (CrazyGames / GD / null adapter)
├── orbit-hopper/             # Featured flagship game
│   ├── index.html
│   ├── promo.html            # 512×512 and 1280×720 cover art
│   ├── smoke-test.js         # Headless runtime test
│   └── js/
│       ├── game.js           # ~1700 lines — full state machine + power-ups
│       ├── audio.js          # ZzFX + ambient drone + gameplay melody sequencer
│       ├── ads.js
│       ├── input.js          # Unified pointer/keyboard → virtual canvas coords
│       ├── ui.js             # Canvas-drawn icon primitives
│       └── main.js
├── company-website/          # PixelNova Studios landing page
│   └── index.html            # Single-file, no dependencies
├── src/                      # DailyNews React app (Udemy course scaffold)
├── docs/                     # This documentation
└── CLAUDE.md                 # AI assistant instructions
```

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Vanilla JS (ES5/ES6, no transpilation) |
| Rendering | Canvas2D API, 390×844 virtual px |
| Audio | ZzFX (MIT, embedded inline) + Web Audio API oscillators |
| Ads | Custom AdManager with pluggable adapters |
| Build | None — zero dependencies, zero npm |
| Testing | `node --check` (syntax), `node smoke-test.js` (headless), Playwright (E2E) |

---

## Shared Architecture Pattern

Every mini-game in `games/` follows an identical module pattern:

```js
'use strict';
var GameName = (function () {
  var VW = 390, VH = 844;    // Virtual canvas dimensions
  var canvas, ctx;
  var state = 'MENU';         // Initial state
  var score, best, lives;

  function init(canvas, bestScore) { ... }
  function startGame() {
    try { AdManager.gameplayStart(); } catch(e) {}
    state = 'PLAYING';
  }
  function update(dt) {
    if (dt > 0.05) dt = 0.05;  // dt clamp — all 100 games
    if (state !== 'PLAYING') return;
    // ... game logic
  }
  function draw() { ... }
  function tap(x, y) { ... }
  function getScore() { return score; }
  function getState() { return state; }

  return { init, update, draw, tap, getScore, getState };
})();
```

### Script Load Order (index.html)
```
audio.js → ads.js → game.js → main.js
```
`main.js` boots the rAF loop: `dt = Math.min((ts - prev) / 1000, 0.05)`.

---

## State Machine (all 100 games)

```
MENU → PLAYING → DEAD
          ↑          ↓
     (restart)   (ad + double score offer)
```

Some games add states: `WIN`, `PAUSED`, `RESULTS`.

---

## dt Clamping

All 100 games were audited and patched in PR #22 to include:
```js
if (dt > 0.05) dt = 0.05;
```
This caps the maximum time step to prevent physics tunneling when the browser tab is backgrounded.

---

## Audio System (`audio.js`)

All 100 mini-games use the same ZzFX-based audio module:
- Sounds pre-rendered at init into PCM buffers
- Played via Web Audio API `AudioContext.createBufferSource()`
- Lazy AudioContext (created on first user gesture)
- Common sounds: `hop`, `coin`, `crash`, `lose`, `win`, `pop`

---

## Ad System (`ads.js`)

Three adapters controlled by `config.adapter`:

| Adapter | Use case |
|---------|----------|
| `'null'` | Default / local dev — no ads |
| `'crazygames'` | CrazyGames SDK v3 integration |
| `'gamedistribution'` | GameDistribution SDK v4 integration |

Ad calls in all games:
```js
AdManager.gameplayStart()   // on PLAYING entry
AdManager.gameplayStop()    // on DEAD/WIN
AdManager.onRunEnd()        // triggers interstitial eligibility
AdManager.showInterstitial(callback)  // 1 per 3 runs, 60s gap
AdManager.offerDoubleScore(score, localStorageKey)  // rewarded ad
```

---

## Orbit Hopper (flagship)

Extended architecture beyond the 100-game pattern:

| Feature | File | Description |
|---------|------|-------------|
| Input abstraction | `input.js` | Unified touch/keyboard → virtual coords |
| Icon primitives | `ui.js` | Canvas-drawn icons (no images) |
| Ambient drone | `audio.js` | 4-voice pentatonic oscillator for menu |
| Gameplay music | `audio.js` | 8-step melodic sequencer at 180 BPM |
| Power-ups | `game.js` | Shield (cyan) + Slow-Mo (purple) tokens |
| Milestone flash | `game.js` | Score celebrations at 10/25/50/100/250 |
| Haptic feedback | `game.js` | `navigator.vibrate()` at all key events |

---

## localStorage Keys

### Orbit Hopper
| Key | Value |
|-----|-------|
| `orbit_best` | Highest score |
| `orbit_runs` | Total runs played |
| `orbit_muted` | `'1'` = muted |
| `orbit_maxlevel` | Highest difficulty level reached |

### Mini-games (pattern)
Each game stores: `{gamename}_best` — highest score achieved.

---

## Performance Budget

| Metric | Target |
|--------|--------|
| Frame rate | 60 FPS |
| Total file size per game | < 3 MB |
| Canvas draw calls per frame | < 200 |
| Audio buffers | Pre-rendered at init, minimal runtime cost |

---

## Running Locally

```bash
# Run a mini-game (e.g. arrow-dodge)
python3 -m http.server 8889 --directory games/arrow-dodge

# Run Orbit Hopper
python3 -m http.server 8080 --directory orbit-hopper

# Run company website
python3 -m http.server 9000 --directory company-website

# Syntax check any game
node --check games/arrow-dodge/js/game.js

# Orbit Hopper headless test
node orbit-hopper/smoke-test.js
```

---

## Games Index (100 games)

| # | Game | Mechanic | Category |
|---|------|----------|----------|
| 1 | arrow-dodge | Shoot targets, dodge return arrows | Arcade |
| 2 | asteroid-belt | Navigate ship through asteroid field | Arcade |
| 3 | balance-beam | Keep object balanced on platform | Skill |
| 4 | basket-shot | Aim and shoot basketball into hoop | Sports |
| 5 | billiard-aim | Pool/billiard ball aiming puzzle | Sports |
| 6 | block-blast | Match and clear falling blocks | Puzzle |
| 7 | block-breaker | Breakout-style brick breaker | Arcade |
| 8 | block-drop | Stack falling blocks precisely | Puzzle |
| 9 | bomb-squad | Defuse bombs before they explode | Action |
| 10 | bounce-master | Bounce ball to hit targets | Skill |
| 11 | bowling-strike | Aim bowling ball for strikes | Sports |
| 12 | bubble-pop | Pop bubbles in order or by color | Casual |
| 13 | bunny-hop | Hop between platforms avoiding gaps | Platformer |
| 14 | candy-rain | Catch falling candy, avoid bad items | Casual |
| 15 | cannon-launch | Aim cannon to hit targets | Skill |
| 16 | card-pairs | Memory card matching game | Puzzle |
| 17 | cave-runner | Endless runner through cave | Arcade |
| 18 | chain-blast | Connect same-color gems to explode | Puzzle |
| 19 | chain-tap | Tap chains in correct order | Reflex |
| 20 | city-stack | Stack falling buildings on each other | Skill |
| 21 | cloud-hop | Hop between cloud platforms | Platformer |
| 22 | coin-catch | Catch falling coins, avoid obstacles | Casual |
| 23 | color-burst | Match and burst color bubbles | Arcade |
| 24 | color-flood | Fill board with one color spreading | Puzzle |
| 25 | color-memory | Remember and repeat color sequences | Memory |
| 26 | color-switch | Switch character color to match obstacles | Arcade |
| 27 | color-tap | Tap colored circles in sequence | Reflex |
| 28 | crystal-stack | Stack crystals without toppling | Skill |
| 29 | dino-dash | Endless running dinosaur | Arcade |
| 30 | dodge-rush | Dodge incoming obstacles at speed | Arcade |
| 31 | dot-link | Connect dots of the same color | Puzzle |
| 32 | egg-drop | Catch falling eggs, avoid rocks | Casual |
| 33 | electric-dash | Dash through electric fields | Arcade |
| 34 | endless-runner | Generic endless side-scroller | Arcade |
| 35 | fireball-run | Dodge fireballs while running | Arcade |
| 36 | flash-tap | Tap flashing targets quickly | Reflex |
| 37 | fruit-catcher | Catch fruit, avoid rotten pieces | Casual |
| 38 | gem-collector | Collect gems, avoid hazards | Arcade |
| 39 | golf-lite | Mini golf with simplified physics | Sports |
| 40 | gravity-flip | Flip gravity to navigate obstacles | Arcade |
| 41 | gravity-maze | Navigate ball through gravity puzzle | Puzzle |
| 42 | grid-snake | Classic snake on a grid | Arcade |
| 43 | hex-flip | Flip hexagonal tiles to clear board | Puzzle |
| 44 | laser-maze | Redirect laser beams to hit targets | Puzzle |
| 45 | lava-surf | Surf platforms above lava | Arcade |
| 46 | leaf-fall | Guide falling leaf to targets | Skill |
| 47 | lightning-grab | Grab lightning bolts for points | Reflex |
| 48 | line-breaker | Draw lines to break blocks | Arcade |
| 49 | magma-hop | Hop platforms over magma | Platformer |
| 50 | match-gems | Match 3+ gems to clear | Puzzle |
| 51 | memory-flip | Card flip memory matching | Memory |
| 52 | mirror-tap | Mirror the shown pattern by tapping | Reflex |
| 53 | missile-evade | Dodge incoming missiles | Arcade |
| 54 | neon-path | Draw neon paths to connect points | Puzzle |
| 55 | neon-snake | Neon-themed snake game | Arcade |
| 56 | ninja-run | Ninja parkour runner | Platformer |
| 57 | number-merge | Merge number tiles (2048-style) | Puzzle |
| 58 | number-order | Tap numbers in ascending order | Reflex |
| 59 | orb-collector | Collect orbs, avoid hazards | Arcade |
| 60 | orbit-tap | Tap planets in orbit patterns | Rhythm |
| 61 | paint-fill | Fill areas with paint | Casual |
| 62 | pattern-repeat | Repeat displayed patterns | Memory |
| 63 | peg-drop | Drop balls through pegs | Skill |
| 64 | pinball-lite | Simplified pinball | Arcade |
| 65 | pipe-rush | Connect pipe segments before time runs out | Puzzle |
| 66 | pixel-trace | Trace pixel art patterns | Skill |
| 67 | plank-bridge | Lay planks to cross gaps | Puzzle |
| 68 | pool-shots | Pool table shot challenges | Sports |
| 69 | potion-grab | Grab falling potions | Casual |
| 70 | pulse-dodge | Dodge pulsing obstacles | Arcade |
| 71 | rail-slide | Slide on rails, jump obstacles | Arcade |
| 72 | reflex-tap | Pure reflex tapping game | Reflex |
| 73 | rhythm-tap | Tap in rhythm with music | Rhythm |
| 74 | rooftop-run | Run and jump across rooftops | Platformer |
| 75 | sequence-game | Simon Says pattern game | Memory |
| 76 | shadow-slide | Slide matching shadows | Puzzle |
| 77 | shape-recall | Recall and recreate shapes | Memory |
| 78 | sky-hopper | Hop upward between sky platforms | Platformer |
| 79 | slingshot-aim | Slingshot physics aiming | Skill |
| 80 | snowball-catch | Catch snowballs, avoid hazards | Casual |
| 81 | space-runner | Space-themed endless runner | Arcade |
| 82 | speed-click | Click targets as fast as possible | Reflex |
| 83 | spike-field | Navigate through spike obstacles | Arcade |
| 84 | spiral-draw | Draw perfect spirals | Skill |
| 85 | spot-it | Spot the difference/matching | Puzzle |
| 86 | stack-tower | Stack falling blocks into tower | Skill |
| 87 | star-blaster | Shoot falling stars | Arcade |
| 88 | star-grab | Grab stars before they fall away | Reflex |
| 89 | symbol-hunt | Find matching symbols quickly | Reflex |
| 90 | tap-blast | Tap to blast approaching objects | Arcade |
| 91 | target-blitz | Shoot multiple targets quickly | Arcade |
| 92 | tetro-drop | Tetris-style block dropping | Puzzle |
| 93 | tile-tap | Tap tiles in correct patterns | Reflex |
| 94 | tower-build | Build tower by stacking blocks | Skill |
| 95 | traffic-rush | Dodge traffic in lane-based game | Arcade |
| 96 | wall-rise | Jump over rising walls | Arcade |
| 97 | water-flow | Connect water flow pipes | Puzzle |
| 98 | whack-mole | Whack-a-mole style game | Arcade |
| 99 | word-blitz | Spell target words from letter bubbles | Word |
| 100 | zombie-smash | Smash zombies before they cross center | Action |
