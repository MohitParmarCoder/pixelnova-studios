# Mirror Tap — Usability Report

## Controls
- **Primary mechanic:** Tap dots on the right half of the screen to mirror the highlighted pattern shown on the left half; only the right half accepts input during the TAP phase (`x < VW/2` taps are silently rejected)
- **State navigation:** Tap anywhere on MENU to start; tap anywhere on DEAD overlay to restart
- **Keyboard support:** None — only `tap(x, y)` is exposed

## Learning Curve
The concept requires brief explanation but the on-screen text "Mirror the left pattern / on the right side!" covers it clearly. The first few rounds use only 3 dots with 2.1 seconds to memorise, making the initial experience forgiving. The spatial challenge of mentally mirroring X-coordinates (right becomes left) is the core skill, and this is not trivially obvious — some first-time players will attempt to tap dots at the same position rather than the mirrored position. The column labels "ORIGINAL" and "YOUR MIRROR" help establish the split-screen metaphor.

## Visual Feedback
- **Score display:** Top-left, `Score: {n}`, bold white 24 px
- **Lives display:** Top-right, heart glyphs `♥`/`♡` in red (`#f87171`), 22 px
- **Phase prompt:** Centred at y=110, either `"Memorize..."` (SHOW phase) or `"Tap mirrors! ({n}/{total})"` (TAP phase) — the TAP prompt shows progress which is excellent UX
- **Active dots (left side):** Gold fill (`#FFD700`) with shadow glow blur 10; inactive dots are near-invisible `rgba(255,255,255,0.1)`
- **Tapped dots (right side):** Green fill (`#6BCB77`) with shadow glow when tapped; untapped right dots show as `rgba(255,255,255,0.05)` during SHOW (hidden) and `rgba(255,255,255,0.15)` during TAP (subtle guide)
- **Round completion:** `Audio.play('gem')` sound; 500 ms delay before new round — no visual "success" banner
- **Vertical centre line:** `rgba(168,237,234,0.3)` dashed line clearly divides the two halves
- **DEAD overlay:** Dark semi-transparent cover; `GAME OVER` in red with neon glow, rounds score in cyan, best in gold, retry prompt in white
- **No particle effects** — feedback is purely colour/glow changes on dots

## Accessibility Notes
- Colour coding uses two distinct hues (gold for pattern, green for correct taps) that are distinguishable for most forms of colour blindness
- The `♥`/`♡` hearts for lives use Unicode — may render inconsistently across Android/iOS but are universally understood
- One-handed playability: good — tapping on the right half only is natural for right-handed players; left-handed players may find the left-side-only viewing and right-side-only tapping slightly awkward
- Session length: very short — rounds are 3–5 seconds each; a full run is 2–5 minutes

## Mobile Optimization
- Touch targets: dots are 18 px radius with a 22 px hit radius (generous, ~4 px extra buffer on all sides)
- Dot positions within the right half are constrained: `x: 40 to VW/2–40` on left side, mirrored to right; y: `250 to VH–170` — avoids HUD overlap
- Portrait orientation assumption is strong: the centre line mechanic only works in portrait

## Known UX Issues
- **No success animation between rounds:** When a round completes, the board just disappears for 500 ms then a new one appears. A brief flash or "Round {n} clear!" text would improve satisfaction.
- **Wrong-tap penalty with no visual distinction:** When a wrong dot is tapped, a life is lost but the wrong dot does not visually mark itself as wrong. Players get the `crash` sound and see a heart disappear but cannot tell which dot was the error.
- **`showInterstitial` missing try/catch:** `AdManager.showInterstitial(() => {})` in the death path is not wrapped in try/catch (unlike `gameplayStop`/`onRunEnd` which are). If `AdManager.showInterstitial` throws synchronously this could crash the game.
- **Left-half tap rejection is silent:** Tapping on the left half during TAP phase does nothing and gives no feedback — new players may think the game is broken.
- **Dot positions re-randomised every round:** Players cannot build spatial memory across rounds, which makes the game harder than necessary and may be frustrating. Fixed dot positions with only the active pattern changing would be fairer.
