# Bounce Master — Future Enhancements

## Priority 1 — Gameplay Depth

### Adjustable AI Difficulty
- **Problem**: AI uses a fixed lag coefficient (`clamp(3 * dt, 0, 1)`). Beginners lose too often; experienced players may find it easy after a few rounds.
- **Proposal**: Scale the coefficient from 0.03 (easy) to 0.12 (hard) based on cumulative `score` or a pre-game difficulty selector.
- **Effort**: Low — single constant change.

### Serving Animation
- **Problem**: After each goal, the puck resets instantly. Players have no time to reorient.
- **Proposal**: Add a 1–2 s SERVING sub-state where the puck is held at center with a countdown pulse before play resumes.
- **Effort**: Low.

### Power-Ups
- **Proposal**: Randomly spawning items on the field:
  - Speed boost: temporarily raises `SPEED_CAP` to 1100 for the player.
  - Shrink AI paddle: temporarily reduces AI `PADDLE_R` from 30 to 15 for 5 s.
  - Wide paddle: temporarily increases player `PADDLE_R` to 50 for 5 s.
- **Effort**: Medium — requires item spawn logic and collision detection extension.

---

## Priority 2 — Progression & Retention

### Persistent Stats
- Track wins, losses, total goals, and longest rally in `localStorage`.
- Display a simple stats screen accessible from MENU.
- Keys to add: `'bouncemaster_wins'`, `'bouncemaster_goals'`.

### Difficulty Scaling Over Score
- Increase `SPEED_CAP` from 700 toward 900 as `score` rises.
- Makes high-score runs genuinely tense without changing early-game feel.

### Round Recap
- After each round, briefly show "You: 3 — AI: X" before transitioning.
- Reinforces the round-based structure and gives players feedback.

---

## Priority 3 — Monetization

### Rewarded Continue
- On DEAD, offer "Watch ad to restore 1 life" via a second rewarded video slot.
- Pairs well with the existing `offerDoubleScore` — show one or the other, not both.

### Bonus Round
- Every 3 rounds won, trigger a BONUS ROUND: larger puck (`PUCK_R = 35`), no AI movement, player tries to score 5 goals in 15 s.
- Naturally high-value ad placement: show interstitial after bonus round ends.

---

## Priority 4 — Polish

### Particle Variety
- Current `particles` array drives a generic burst. Add directional sparks on fast puck-paddle collisions (when `|vx| > 400` or `|vy| > 400`).

### Screen Shake
- Add a small canvas translate shake (±4 px, 200 ms decay) on AI goal and player death events.

### Pause Button
- Add a pause icon in the top corner during PLAYING state.
- Transition to a PAUSED state that freezes physics and dims the canvas.

### Haptic Feedback
- Call `navigator.vibrate(30)` on paddle hit and `navigator.vibrate(80)` on goal for supported devices.

---

## Technical Debt

| Item | Notes |
|---|---|
| No automated tests | Add a headless smoke test (`node smoke-test.js`) verifying state transitions and score logic |
| `localStorage` not try/catch wrapped | Add fallback for private browsing mode or storage-quota errors |
| Constants not exposed as config | Externalizing `SPEED_CAP`, `AI_GOAL_LIMIT` would simplify difficulty tuning without editing game source |
