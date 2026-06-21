# Card Pairs — Future Enhancements

## Priority Enhancements

### 1. Themed card sets (animals, space, food) — drawn procedurally
### 2. Multiplayer race mode (both players see same board, race to clear)
### 3. Hint system: briefly reveal one unmatched pair (costs 5 points)
### 4. Difficulty levels: 4×4, 5×4, 6×5 grid sizes
### 5. Speed bonus multiplier for quick matches

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
Add "Share Score" button on DEAD screen that generates a simple text share ("I scored X in Card Pairs! Can you beat me?").

## Technical Debt
- Consolidate particle system into shared utility (currently duplicated across games)
- Add `node orbit-hopper/smoke-test.js`-style smoke test to each game directory
- Replace `var` with `const`/`let` throughout for modern JS consistency
