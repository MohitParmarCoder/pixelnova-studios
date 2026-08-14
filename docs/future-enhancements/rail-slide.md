# Rail Slide — Future Enhancements

## Priority Enhancements

### 1. Difficulty Tiers
Add Easy/Normal/Hard preset at MENU — affects spawn rate, speed cap, and initial lives.

### 2. Score Milestone Celebrations
Flash "SCORE 25!" overlay with particle burst at milestone scores (10, 25, 50, 100, 250). Reuse particle system.

### 3. Haptic Feedback
Add `navigator.vibrate()` on key events: success (10ms), life loss (30ms), game over ([30,60,80]).

### 4. Daily Challenge Mode
Seeded daily variant — same conditions for all players. Show "Daily Best" alongside all-time best.

### 5. Streak Multiplier
Track consecutive successful actions without error. 5-streak = 2× points; 10-streak = 3× points. Display streak counter in HUD.

## General Improvements

### Technical Debt
- Replace `var` with `const`/`let` throughout for modern JS consistency
- Add per-game smoke-test similar to orbit-hopper/smoke-test.js

### Accessibility
- Add colorblind mode (shape patterns supplement color-only cues)
- Configurable touch target size multiplier

### Analytics
Send lightweight events to CrazyGames SDK for portal visibility: session start, score milestone, session end.
