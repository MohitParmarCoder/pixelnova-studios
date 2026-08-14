# Shadow Slide — Usability Report

## Controls
Single-tap / click anywhere on the canvas to jump. No swipe or drag input is used. On desktop, a mouse click or spacebar tap (if wired) triggers the same action. The control scheme is intentionally minimal — one action throughout.

## Learning Curve
- **Seconds 0–5**: Player immediately understands "tap to jump" from the MENU prompt.
- **First 10 s of play**: The darkness overlay is the primary surprise; players realize quickly that only the spotlight area is usable for navigation.
- **10–30 s**: Internalize the rhythm of jumping ahead of the spotlight edge — jumping blind once a platform exits the lit zone.
- **30 s+**: Speed increase becomes noticeable; muscle memory required to pre-time jumps at MAX_SPEED.

## Visual Feedback
- **Spotlight**: The `destination-out` candle-light effect is the game's signature visual. The circle radius (130 px) is always centered on the player orb, so players see roughly 1–2 platforms ahead.
- **Glowing orb**: Player is rendered with a yellow glow, providing a clear focal point even at the edge of the spotlight.
- **Platform scroll**: Smooth horizontal scroll gives clear sense of speed increase.
- **Score counter**: Displayed in HUD; increments immediately on landing, giving instant positive reinforcement.
- **Lives display**: Visible in the HUD at all times so the player knows how many respawns remain.

## Accessibility Notes
- No color-only information — the player is distinguishable by glow shape, not color alone.
- High contrast between the glowing orb and the dark overlay benefits low-vision users within the spotlight zone.
- No time-limited menus — DEAD screen waits for user input indefinitely.
- No audio dependency: the game is fully playable with sound muted.
- Missing: no text alternative for gameplay instructions (icon-only UI recommended by portal guidelines).

## Mobile Optimization
- Virtual canvas is 390×844, matching a standard portrait smartphone viewport.
- Single-tap input is native mobile gesture; no multi-touch required.
- Fixed `PLAYER_X=100` means the player never needs to track horizontal movement, reducing cognitive load on small screens.
- The darkness effect is purely canvas-based — no CSS filter reliance, so it renders efficiently on mid-range Android devices.

## Known UX Issues
1. **Blind jumps at high speed**: Once `SCROLL_SPEED` nears `MAX_SPEED`, platforms may enter and exit the spotlight within a single frame of reaction time, which some players find unfair rather than challenging.
2. **No jump-cancel**: Tapping twice in quick succession triggers two jumps with no debounce guard, which can send the player off-screen upward.
3. **Respawn disorientation**: On life loss, platforms reset instantly with no transition animation, which can feel abrupt.
4. **No haptic feedback**: Mobile players receive no vibration on death, missing an opportunity for tactile confirmation.
