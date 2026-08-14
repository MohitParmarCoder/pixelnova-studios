# Revenue Strategy — PixelNova Studios Game Portfolio

## Portfolio Overview

100 mini-games + 1 flagship (Orbit Hopper) targeting CrazyGames and GameDistribution as primary platforms.

---

## Revenue Streams

### 1. Display Interstitials
- Triggered between runs (every 3+ runs, 60s gap minimum)
- Estimated CPM: $1.50–$4.00 (CrazyGames), $0.80–$2.50 (GD)
- Highest fill rate on mobile portrait orientation (our format)

### 2. Rewarded Video (Double Score)
- Triggered on player death — high intent moment
- Player watches ad → score doubled, new best saved
- Estimated CPM: $5.00–$15.00
- **Recommended priority:** maximize rewarded ad integration first

### 3. Direct Revenue (future)
- In-app purchases via CrazyGames coins (for cosmetic unlocks)
- Requires CrazyGames Plus SDK integration

---

## Platform Strategy

### CrazyGames (Primary)
- Audience: 35M+ monthly players
- Best for: Arcade, Puzzle, Casual games
- Revenue share: Publisher retains ~50% after platform cut
- Category guidelines: Strictly enforce category accuracy (wrong category = rejection)

**Submission priority order:**
1. Orbit Hopper (flagship, already submitted — resubmit after quality fixes)
2. High session-length games: memory-flip, number-merge, tetro-drop, grid-snake
3. Reflex/arcade with broad appeal: flash-tap, zombie-smash, whack-mole, target-blitz
4. Casual/family: candy-rain, egg-drop, fruit-catcher, snowball-catch
5. Remaining 90 games in batches of 10

### GameDistribution (Secondary)
- Audience: 350M+ monthly players (wider but lower CPM)
- Best for: Casual, family-friendly games
- Faster approval process than CrazyGames

---

## Recommended Category Mapping (CrazyGames)

| Category | Games |
|----------|-------|
| **Arcade** | arrow-dodge, asteroid-belt, block-breaker, cave-runner, color-burst, dino-dash, dodge-rush, electric-dash, endless-runner, fireball-run, flash-tap, gem-collector, gravity-flip, lava-surf, line-breaker, missile-evade, neon-snake, ninja-run, orb-collector, orbit-hopper, pulse-dodge, rail-slide, rooftop-run, sky-hopper, space-runner, spike-field, star-blaster, tap-blast, target-blitz, traffic-rush, wall-rise, zombie-smash |
| **Puzzle** | block-blast, block-drop, chain-blast, color-flood, dot-link, gravity-maze, hex-flip, laser-maze, match-gems, neon-path, number-merge, paint-fill, peg-drop, pipe-rush, plank-bridge, tetro-drop, water-flow |
| **Casual** | bubble-pop, candy-rain, cloud-hop, coin-catch, egg-drop, fruit-catcher, golf-lite, magma-hop, potion-grab, snowball-catch |
| **Sports** | basket-shot, billiard-aim, bowling-strike, pool-shots |
| **Skill** | balance-beam, bounce-master, bunny-hop, cannon-launch, city-stack, crystal-stack, leaf-fall, pixel-trace, slingshot-aim, spiral-draw, stack-tower, tower-build |
| **Memory** | card-pairs, color-memory, memory-flip, pattern-repeat, sequence-game, shape-recall |
| **Reflex** | chain-tap, color-tap, lightning-grab, mirror-tap, number-order, orbit-tap, reflex-tap, shadow-slide, speed-click, spot-it, symbol-hunt, tile-tap |
| **Word** | word-blitz |
| **Rhythm** | rhythm-tap |

---

## Revenue Projections (estimates)

Assumes 10,000 monthly plays per game after 6 months on CrazyGames.

| Metric | Estimate |
|--------|---------|
| Games on CrazyGames | 100 |
| Avg monthly plays/game | 10,000 |
| Total monthly plays | 1,000,000 |
| Interstitial fill rate | 70% |
| Avg CPM | $2.50 |
| Interstitials per 1000 plays | 0.5 |
| Monthly interstitial revenue | **$875** |
| Rewarded ad opt-in rate | 15% |
| Rewarded CPM | $8.00 |
| Monthly rewarded revenue | **$1,200** |
| **Total monthly estimate** | **~$2,075** |

*Note: Orbit Hopper as a featured game could generate 100K+ plays alone.*

---

## Quality → Revenue Correlation

CrazyGames gates traffic behind quality scores. Higher quality = more editorial featuring = exponentially more traffic.

| Quality tier | Traffic multiplier |
|--------------|-------------------|
| Rejected | 0× |
| Accepted, no feature | 1× baseline |
| Featured in category | 5–20× |
| Homepage feature | 50–200× |

**Key quality signals:**
- Gameplay music (currently missing from most mini-games)
- Haptic feedback
- Score milestones / celebrations
- Power-ups and depth of mechanic
- Polished visuals (no broken states, smooth animations)

**Action:** Implement music + haptics across all 100 games to maximize acceptance rate.

---

## Implementation Roadmap

| Phase | Action | Timeline | Revenue Impact |
|-------|--------|----------|---------------|
| 1 | Fix CrazyGames category for Orbit Hopper (user action in portal) | Immediate | Unblocks flagship |
| 2 | Resubmit Orbit Hopper with PR #23 quality fixes | Week 1 | Flagship revenue |
| 3 | Submit top 20 high-quality games to CrazyGames | Week 2–3 | Base revenue |
| 4 | Add gameplay music to all 100 mini-games | Month 1–2 | 2–3× acceptance rate |
| 5 | Submit remaining 80 games | Month 2–3 | Full portfolio revenue |
| 6 | Submit all to GameDistribution | Month 3–4 | Secondary revenue stream |
| 7 | Implement rewarded ads for extra lives | Month 4 | +40–60% revenue |
