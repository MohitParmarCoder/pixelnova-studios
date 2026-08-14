# Space Runner — Future Enhancements

## Priority 1 — Quality
- **Input lock on death**: Add a 500 ms input lock after the DEAD state is set to prevent accidental restarts when the player is tapping rapidly at the moment of death.
- **NaN best-score guard**: Wrap `localStorage.getItem('spacerunner_best')` in `parseInt(...) || 0` to handle corrupt storage gracefully.
- **Alien out-of-bounds guard**: Ensure no alien bullet is fired when `aliens.filter(a => a.alive).length === 0` to prevent a potential crash if all aliens die in the same frame an alien shoot timer fires.
- **Consistent frame-rate independence**: Audit all velocity and timer updates to confirm every one multiplies by `dt`; fix any that accidentally use raw values.

## Priority 2 — Content
- **More alien types**: Introduce armored aliens (require 2 hits) at wave 5+ and fast zigzag aliens at wave 8+.
- **Boss wave**: Every 5 waves, spawn a single large boss alien with a health bar and multi-directional shooting.
- **Power-ups**: Dropped by killed aliens — spread shot (3 bullets), shield (absorbs 1 hit), rapid fire (halves shootInterval for 5 s).
- **Background parallax**: Add 2–3 layers of scrolling stars at different speeds for depth.
- **Wave preview**: Brief 1-second overlay showing "WAVE N" text before each wave spawns.

## Priority 3 — Polish
- **Ship thruster particle trail**: Emit 2–3 small particles from the ship's base each frame while PLAYING.
- **Screen shake on player hit**: Offset the canvas draw by ±4 px for 0.3 s on player damage.
- **Alien entry animation**: Aliens slide in from the top of the screen at wave start rather than appearing instantly.
- **Score pop-up**: Show floating "+N" text at the alien's death position for 0.5 s.
- **High-score celebration**: Play a distinct sound and show a brief animation when a new best score is set.

## Priority 4 — Monetization
- **Daily challenge mode**: A fixed-seed wave sequence that resets each day, driving daily return visits and increasing ad impressions.
- **Leaderboard**: Optional server-side score board (or CrazyGames built-in leaderboard API) to increase session length through competition.
- **Double-score prompt styling**: Design a dedicated DEAD screen UI panel that clearly highlights the rewarded-ad double-score offer with a contrasting button.
- **Achievement badges**: Unlockable milestones (e.g., "Wave 10 Cleared", "100 Aliens Killed") shown on the MENU screen to increase engagement.

## Estimated Effort

| Enhancement | Effort | Impact |
|---|---|---|
| Input lock on death | 0.5 h | Medium — prevents UX frustration |
| NaN best-score guard | 0.25 h | Low — rare edge case |
| Alien out-of-bounds guard | 0.25 h | High — prevents potential crash |
| More alien types | 4 h | High — extends replayability |
| Boss wave | 6 h | High — major content milestone |
| Power-ups | 5 h | High — core fun factor |
| Background parallax | 1.5 h | Medium — polish |
| Screen shake | 0.5 h | Medium — juice |
| Alien entry animation | 1 h | Low — polish |
| Daily challenge mode | 8 h | High — monetization driver |
| Leaderboard integration | 6 h | Medium — depends on portal API |
