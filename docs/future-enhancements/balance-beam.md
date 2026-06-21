# Balance Beam — Future Enhancements

## Priority Enhancements

### 1. Visual physics feedback — beam flex/bend near max angle
### 2. Combo bonus for balancing items symmetrically
### 3. Timer mode: balance as many items as possible in 60 seconds
### 4. Power items: 'anvil' (heavy, clear a side) or 'balloon' (negative weight)
### 5. Haptic vibration when beam approaches max angle

## General Improvements (applicable to all games)

### Haptic Feedback
Add `navigator.vibrate()` calls at key events (tap success, life loss, game over). Wrap in try/catch for browser compatibility.

### Score Milestones
Flash a celebration overlay at milestone scores (10, 25, 50, 100, 250). Reuse existing particle system. Play `highscore` ZzFX sound.

### Daily Challenge Mode
Add a seeded daily variant where all players get the same board/sequence. Show global daily leaderboard position.

### Accessibility Improvements
- Add colorblind mode (pattern/shape distinctions supplement color-only differences)
- Configurable tap target size multiplier (1x, 1.5x, 2x)

### Analytics Events
Send lightweight events to CrazyGames SDK for: session start, first play, score milestone, session end. Helps with portal visibility.

### Social Sharing
Add "Share Score" button on DEAD screen that generates a simple text share ("I scored X in Balance Beam! Can you beat me?").

## Technical Debt
- Consolidate particle system into shared utility (currently duplicated across games)
- Add `node orbit-hopper/smoke-test.js`-style smoke test to each game directory
- Replace `var` with `const`/`let` throughout for modern JS consistency
