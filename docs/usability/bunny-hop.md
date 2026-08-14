# Usability Documentation: Bunny Hop

## Target Audience

Casual mobile/browser players familiar with endless jumper games (Doodle Jump, Pogo Swing). No tutorial required — mechanic is discoverable in the first few seconds of play.

## Controls

| Input | Action |
|---|---|
| Tap left half of screen | Bunny moves left (`bvx = -180`), jump if on platform or bvy > -200 |
| Tap right half of screen | Bunny moves right (`bvx = 180`), same jump condition |
| Any tap on MENU screen | Transitions to PLAYING |

### Jump Condition Detail
`bvy` is set to `-750` only if `onPlatform` is true or `bvy > -200`. This prevents spamming double-jumps mid-air while still allowing a corrective boost when the bunny is barely off a platform.

## Screen Layout

### MENU
- Game title centered
- Best score displayed
- Tap-to-start prompt

### PLAYING
- Score (top area) — shows `scoreBase + carrotBonus`
- Bunny (30 x 36 px sprite) navigates upward through platforms
- Carrots scattered on/near platforms
- Camera holds bunny at ~35% from top of screen (`VH * 0.35`)

### DEAD
- Final score displayed
- Best score shown (updated if new record)
- Double-score offer (ad-gated)
- Tap to return to MENU

## Difficulty Progression

The game speeds up continuously with height climbed:
```
platformSpeed = min(280, 60 + scrollY * 0.015)
```
At `scrollY = 0`: 60 px/s. At `scrollY = 5000`: ~135 px/s. At `scrollY ~= 14667`: cap of 280 px/s. Players feel escalating challenge without any discrete "level" announcement.

## Death Condition

Falling off the bottom of the screen ends the run immediately. There are no lives — single-mistake elimination keeps sessions short and encourages replays.

## Scoring Feedback

- `scoreBase` increments passively with height — visible progress even without collecting carrots.
- `carrotBonus` (+5 each) rewards deliberate route choices.
- Combined `score` display gives players a clear single number to chase.

## Usability Concerns & Recommendations

### Strengths
- Immediate input feedback: direction + jump in one tap keeps controls simple.
- Horizontal wrapping prevents "stuck at an edge" frustration.
- Progressive speed ramp is smooth, not jarring.

### Known Issues
- No visual indicator for which half of the screen maps to which direction on first launch.
- `GRAVITY = 1400` and `bvy = -750` feel tuned for mobile; on large desktop monitors the bunny may feel sluggish relative to platform density.
- No pause mechanic — accidental background switch kills the run.

### Recommendations
- Add subtle left/right arrow overlays on first run only.
- Consider a brief platform flash or hop animation on land to reinforce the `'tap'` audio cue visually.
- A "best height" watermark line on screen would help players visualize their personal record mid-run.
