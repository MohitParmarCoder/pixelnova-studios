# Billiard Aim — Usability Report

## Controls

| Action | Input |
|---|---|
| Set aim angle | First tap (toward target direction) |
| Fire cue ball | Second tap (any location) |
| Navigate DEAD → MENU | Tap |

The two-tap system (`tapPhase` 0 then 1) is the defining interaction. No drag, hold, or pinch mechanics.

## Learning Curve

**Moderate barrier:** Two-tap aim-then-shoot is not immediately obvious from a blank screen. Players unfamiliar with billiards may fire in the wrong direction on the first shot because `aimAngle` is computed from the cue ball to the first tap point — tapping near the cue ball produces an unpredictable angle.

**Table context helps:** The realistic table layout (green felt, rails, corner/mid pockets) provides strong genre signaling. Players with any billiards experience will intuit the mechanic within 2–3 shots.

**No aim guide displayed:** Unlike real billiards games, there is no ghost ball or aim line shown during the aim phase. This is a significant discoverability gap — players cannot see where `aimAngle` currently points before confirming the shot.

## Visual Feedback

- **Flash overlay:** Green on target ball pocketed (`flashGood=true`), red on cue ball pocketed (`flashGood=false`).
- **Timer:** Displayed top-right; turns red when `timeLeft <= 10` to signal urgency.
- **Lives top-left:** Numeric or icon display of remaining lives (3 max).
- **Ball colors:** 6 distinct colored target balls provide clear visual differentiation.
- **Pocket markers:** Pocket circles at 6 positions give clear target zones.

## Accessibility

- Timer turning red at 10 s is color-only urgency signal — players with red-green color blindness may miss the transition. A pulsing animation would supplement.
- No text labels on game objects; internationally playable.
- Two-tap mechanic requires understanding of sequence — no in-game tutorial or hint text.
- Audio cues (`tap`, `gem`, `crash`) reinforce events but have visual counterparts.

## Mobile UX

- 390 px virtual canvas is portrait-phone native.
- `BALL_R=14` and `POCKET_R=20` are reasonably sized for touch interaction.
- The two-tap sequence works on touchscreens, but the lack of an aim-line visualization makes targeting imprecise on a small screen where users cannot see the angle they're setting.
- `TABLE={x:30, y:100, w:330, h:544}` fills most of the canvas height — comfortable to tap across without zooming.

## UX Issues / Improvement Opportunities

1. **No aim line during phase 0:** The single largest usability gap. Displaying a line from `cueBall` in direction `aimAngle` during phase 0 would dramatically improve shot accuracy and comprehension.
2. **Two-tap sequence is silent about phase state:** No visual indicator tells the player whether they are in aim phase or shoot phase. A HUD label ("Aim" / "Shoot") or colored cue ball outline would help.
3. **Fixed `aimPower=12`:** No power control means every shot has the same speed, limiting strategic depth. A power slider or hold-duration mechanic would add skill expression.
4. **No cue-ball respawn animation:** After pocketing the cue ball, it reappears instantly — a brief fade-in would reduce visual confusion about where the ball went.
5. **Score not visible on DEAD screen before returning to MENU:** Players lose context about how well they performed.
6. **Timer does not pause during ball-in-motion:** Skilled players may feel penalized for ball physics taking time to settle before they can take their next shot.
