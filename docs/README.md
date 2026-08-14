# PixelNova Studios — Documentation Hub

## Overview
This directory contains comprehensive documentation for the entire PixelNova Studios game portfolio. The portfolio consists of **100 mini-games** plus the flagship title **Orbit Hopper**, all built as zero-dependency HTML5 Canvas games.

## Repository Structure
```
/
├── games/                  # 100 mini-games (each a standalone HTML5 game)
│   └── {game-name}/
│       ├── index.html
│       └── js/
│           ├── audio.js    # ZzFX sound engine
│           ├── ads.js      # Ad adapter (null / crazygames / gamedistribution)
│           ├── input.js    # Unified pointer input
│           ├── ui.js       # Canvas icon primitives
│           ├── game.js     # Game logic (~200–600 lines)
│           └── main.js     # Bootstrap + rAF loop
├── orbit-hopper/           # Flagship game (more advanced)
├── company-website/        # PixelNova Studios landing page
├── src/                    # DailyNews React app (separate project)
└── docs/                   # This documentation
    ├── codebase/           # Per-game code reference
    ├── test-reports/       # Per-game test & performance reports
    ├── deployment/         # Per-game deployment & portal submission guides
    ├── future-enhancements/ # Per-game improvement ideas
    ├── usability/          # Per-game UX analysis
    └── ads-revenue/        # Per-game monetization guide
```

## Documentation Folders

| Folder | Contents | Files |
|---|---|---|
| `codebase/` | State machine, variables, functions, ad integration per game | 101 |
| `test-reports/` | Syntax check, smoke test, PR #22 fix notes, performance | 101 |
| `deployment/` | CrazyGames/GD submission checklist, file structure, local dev | 102 |
| `future-enhancements/` | Prioritized feature ideas per game | 101 |
| `usability/` | UX analysis, accessibility, control scheme per game | 101 |
| `ads-revenue/` | Ad event map, frequency cap, portal config, revenue estimates | 101 |

## All 100 Games

### Action / Endless Runner
arrow-dodge, asteroid-belt, cave-runner, cloud-hop, dino-dash, dodge-rush, electric-dash, endless-runner, fireball-run, gravity-flip, magma-hop, missile-evade, neon-path, ninja-run, rail-slide, rooftop-run, shadow-slide, sky-hopper, space-runner, star-blaster, traffic-rush

### Tap / Reflex
chain-tap, coin-catch, flash-tap, leaf-fall, lightning-grab, orbit-tap, pulse-dodge, reflex-tap, speed-click, star-grab, tap-blast, target-blitz, tile-tap, whack-mole, word-blitz, zombie-smash

### Physics / Sports
balance-beam, basket-shot, billiard-aim, bowling-strike, cannon-launch, golf-lite, lava-surf, line-breaker, peg-drop, pinball-lite, plank-bridge, pool-shots, slingshot-aim, spike-field

### Collect / Catch
candy-rain, egg-drop, fruit-catcher, gem-collector, orb-collector, potion-grab, snowball-catch

### Memory / Sequence
color-memory, flash-tap, memory-flip, pattern-repeat, shape-recall, sequence-game, spiral-draw, spot-it, symbol-hunt

### Match / Puzzle
bubble-pop, chain-blast, color-burst, color-flood, color-switch, crystal-stack, dot-link, electric-dash, gravity-maze, hex-flip, laser-maze, match-gems, neon-snake, paint-fill, pipe-rush, water-flow

### Word / Number
color-tap, grid-snake, number-merge, number-order, word-blitz

### Stack / Build
city-stack, stack-tower, tower-build, tetro-drop, block-blast, block-breaker, block-drop

### Rhythm
rhythm-tap, tile-tap

### Other
neon-path, pixel-trace, rooftop-run, bouncy-master, bunny-hop

## Common Architecture (All Games)

### Script Load Order
```html
<script src="js/audio.js"></script>    <!-- Audio (ZzFX) -->
<script src="js/ads.js"></script>       <!-- AdManager -->
<script src="js/input.js"></script>     <!-- Input -->
<script src="js/ui.js"></script>        <!-- UI icons -->
<script src="js/game.js"></script>      <!-- Game logic -->
<script src="js/main.js"></script>      <!-- Bootstrap -->
```

### Universal State Machine
```
MENU → PLAYING → DEAD
         ↑          |
         └──────────┘ (restart)
```

### Universal Ad Integration
| Event | Call |
|---|---|
| Run start | `AdManager.gameplayStart()` |
| Run end | `AdManager.gameplayStop()` + `onRunEnd()` |
| Between runs | `AdManager.showInterstitial()` |
| Death screen | `AdManager.offerDoubleScore(score, 'KEY')` |

### PR #22 Quality Fixes (applied to all 100 games)
1. **dt clamp**: `if (dt > 0.05) dt = 0.05` prevents physics runaway after tab-switch
2. **Speed caps**: `Math.min(speed, MAX_SPEED)` on 15 high-speed games
3. **Life drain cap**: max 1 life lost per frame for simultaneous hazards
4. **Spawn/restart bugs**: clean state reset on each run
5. **Named game bugs**: word-blitz distractors, traffic-rush dodgeability, whack-mole hitbox, bomb-squad double-tap

## Orbit Hopper (Flagship)
See `orbit-hopper/README.md` for full documentation. Key differences from mini-games:
- More complex state machine (MENU → INFO ⇄ SETTINGS → PLAYING → DYING → RESULTS)
- Power-ups: shield token, slow-mo token
- Gameplay music sequencer (Web Audio API)
- Haptic feedback at key events
- Score milestone celebrations
- SPLASH state removed for CrazyGames compliance

## Quick Commands
```bash
# Run any mini-game locally
python3 -m http.server 8080 --directory games/arrow-dodge

# Syntax check
node --check games/arrow-dodge/js/game.js

# Run Orbit Hopper
python3 -m http.server 8080 --directory orbit-hopper
node --check orbit-hopper/js/game.js
node orbit-hopper/smoke-test.js
```

## Portal Submission Notes

### CrazyGames
- Set `config.adapter = 'crazygames'` in each game's `js/ads.js`
- Add CrazyGames SDK v3 script tag before `ads.js`
- Ensure `sdk.game.gameplayStart()` / `sdk.game.gameplayStop()` fire correctly
- No preloader — games load directly to MENU
- All art is canvas-drawn — zero image files
- Category: **Arcade** (not Clicker)

### GameDistribution
- Set `config.adapter = 'gamedistribution'` in each game's `js/ads.js`
- Add GD SDK script tag before `ads.js`
- Register each game in GD dashboard

See individual `docs/deployment/{game}.md` files for per-game checklists.
