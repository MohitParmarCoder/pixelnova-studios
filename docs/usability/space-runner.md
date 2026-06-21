# Space Runner — Usability Report

## Controls
| Action | Input |
|---|---|
| Move ship | Tap/click anywhere — ship.x snaps to tap x, clamped to [30, VW-30] |
| Fire | Automatic — no player input needed; fires every `shootInterval` seconds |
| Start game | Tap anywhere on MENU screen |
| Restart | Tap anywhere on DEAD screen |

Controls are intentionally minimal: one touch moves the ship. Auto-fire removes timing burden from the player.

## Learning Curve
- **First 10 seconds**: Player discovers tap-to-move mechanic immediately; auto-fire is self-evident.
- **Wave 1–2**: Low alien speed (80–88 px/s) and slow shooting (1.8 s interval) give a forgiving entry.
- **Wave 3+**: Alien speed and shoot frequency increase noticeably; player must prioritize dodge vs. offense.
- **Wave 5+**: Alien speed exceeds 130 px/s; grid descends quickly if not cleared fast enough.
- No tutorial overlay is shown; the mechanic is simple enough to discover through play.

## Visual Feedback
| Event | Feedback |
|---|---|
| Alien killed | 8-particle explosion at alien position |
| Player hit | Life counter decreases; audio `'crash'` plays |
| Wave cleared | Aliens removed; wave counter increments in HUD |
| Game over | State switches to DEAD screen with score summary |
| Auto-fire | Bullet travels up screen — visible confirmation of shooting |
| Ship movement | Instant position snap to tap — immediate response |

## Accessibility Notes
- No color-only information conveyed (lives shown as numeric HUD value, not color alone).
- No screen reader support (canvas game — expected for this genre).
- Text labels on MENU and DEAD screens use readable canvas font sizes.
- Mute support depends on shared `Audio` module; a mute toggle should be accessible from MENU.
- No keyboard-only fallback for ship movement — keyboard arrow keys or WASD could be added.

## Mobile Optimization
- Ship clamp (30 to VW-30) prevents ship from hiding behind screen edges on narrow devices.
- Single-tap mechanic works naturally on touchscreens.
- Canvas is letterboxed to virtual resolution; tap coordinates are mapped to virtual space by `Input`.
- No pinch/zoom interference expected (canvas fills viewport).
- dt clamped to 0.05 s prevents spiral of death on tab switch or slow devices.

## Known UX Issues
1. **No explicit movement indicator**: First-time players may not immediately know tapping moves the ship (no arrow or hint shown).
2. **Auto-fire not communicated**: No visual cue on MENU explains that shooting is automatic.
3. **Wave number only in HUD**: Players have no preview of incoming wave difficulty before it begins.
4. **DEAD screen delay**: No brief delay before DEAD screen accepts input — accidental restart is possible if player is tapping during death.
5. **No pause**: Switching to another app causes dt accumulation mitigated by the 0.05 s clamp, but there is no explicit pause button.
