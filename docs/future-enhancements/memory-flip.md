# Memory Flip — Future Enhancements

## Priority 1 — Quality (CrazyGames acceptance)
- Gameplay music loop: a gentle ambient loop using the Web Audio API, distinct from the sound effects already wired through `Audio.play()`; should pause in `visibilitychange` handler
- Haptic feedback: `navigator.vibrate(30)` on match success and `navigator.vibrate([50,30,50])` on mismatch — reinforces the match/mismatch distinction without requiring eyes on the screen
- Score milestone celebrations: at scores 500, 1000, 2500, and 5000, trigger a full-board pulse where all matched card `pulse` values are set to 1.5 simultaneously and a brief banner text floats up the screen

## Priority 2 — Content
- **New symbol set themes:** Add a "Space" theme (rocket, planet, asteroid, comet, satellite, alien, star, moon, ring, telescope) and a "Nature" theme (leaf, flower, sun, raindrop, mushroom, bee, butterfly, mountain, wave, snowflake) switchable from a pre-game menu — each symbol already has its own `id` and `color`, so adding new SYMBOLS arrays is straightforward
- **Time attack mode:** Fixed 4×4 board, no levels, score based purely on speed — `timeLeft` shown as milliseconds; leaderboard-friendly
- **Daily puzzle:** A seeded shuffle (using the date as an RNG seed) so all players see the same board arrangement each day; best `moves` count shared via leaderboard
- **Hint system:** After 10 seconds of inactivity a card briefly glows its matching pair's colour before fading — consumes 30 points to use

## Priority 3 — Polish
- Combo multiplier system: consecutive matches within 3 seconds of each other multiply the match score by 1.5× / 2× / 3×; combo counter displayed near the HUD
- Card back patterns: the current `?` back could be replaced by decorative per-theme tile patterns (still canvas-drawn paths, no images)
- Level clear fireworks: brief upward particle burst from matched cards on level completion — could reuse the `pulse` system with additional `vy` velocity

## Priority 4 — Monetization
- Rewarded video for time refill: "Watch an ad to get +15 seconds" button on the timer bar when `timeLeft < 10` — clear, non-intrusive placement
- Cosmetic unlocks: alternative symbol colour palettes (neon, pastel, monochrome) unlocked by achieving score milestones; selected colour set persisted to `localStorage`
- Leaderboard integration: submit `score` at run end via CrazyGames SDK `userAccountModule.isUserAccountAvailable` check before posting

## Estimated Effort
| Enhancement | Effort | Impact |
|-------------|--------|--------|
| Game music loop | 2 h | High |
| Haptic feedback | 0.5 h | Medium |
| Score milestone celebrations | 1 h | Medium |
| New symbol themes | 3 h | High |
| Time attack mode | 2 h | High |
| Daily puzzle | 4 h | High |
| Hint system | 1.5 h | Medium |
| Combo multiplier | 2 h | Medium |
| Rewarded time refill ad | 1 h | High |
| Leaderboard integration | 3 h | Medium |
