# Bounce Master — Usability Report

## Game Summary

Bounce Master is a one-finger air hockey game. The player drags their paddle across the bottom half of the screen to deflect a puck into the AI's goal at the top. First to 3 goals wins the round; losing 3 rounds ends the game.

## Target Audience

Casual mobile players aged 10+. Suitable for short sessions of 1–3 minutes.

## Input Model

| Action | Gesture |
|---|---|
| Move paddle | Tap or drag anywhere in the bottom half |
| Navigate menus | Single tap |

- Player paddle is confined to `VH/2 + 20` through `VH - 50` vertically.
- Horizontal movement is unrestricted across the full canvas width.
- No multi-touch required; single-pointer control throughout.

## Onboarding & Clarity

### Strengths
- Single-state input (drag) requires no tutorial.
- Goal lines are visually obvious (top and bottom edges of the field).
- Lives indicator (`lives = 3`) provides clear sense of progress and consequence.
- Round score (`playerGoals / aiGoals`) resets each round so context is always fresh.

### Weaknesses
- No explicit tutorial or instruction text on first run.
- SPEED_CAP mechanic (puck velocity limit of 700) is invisible to the player; unpredictable bounce angles may feel random.
- Lateral velocity transfer (`vx += (puck.x - paddleX) * 0.3`) rewards precise control that is not communicated anywhere.

## Feedback & Feel

| Feedback Type | Implementation |
|---|---|
| Paddle hit | `'tap'` sound + puck velocity change |
| Player goal | `'gem'` sound + score increment |
| AI goal | `'crash'` sound + visual flash |
| Round loss | `lives--` display update |
| Death | `'lose'` sound + DEAD screen |
| Particles | Burst effect on goal events (`particles` array) |
| Pulse animations | `pulseT` timer drives UI element pulsing |

## AI Difficulty

- AI uses a first-order lag filter: `aiX += (puck.x - aiX) * clamp(3 * dt, 0, 1)`.
- At 60 fps (dt ≈ 0.016): catch factor ≈ 0.048 per frame — AI is beatable.
- No adjustable difficulty level; AI speed is fixed.
- Recommendation: expose a difficulty slider or scale the lag coefficient with score.

## Win/Loss Clarity

- Player must score 3 goals (`PLAYER_GOAL_LIMIT`) to win a round.
- AI must score 3 goals (`AI_GOAL_LIMIT`) to remove a life.
- Losing all 3 `lives` transitions to DEAD with final score displayed.
- +50 bonus for winning a round rewards aggressive play but is not surfaced prominently.

## Accessibility Considerations

- No color-only feedback; sounds accompany all key events.
- Large touch targets: paddle radius `PADDLE_R = 30`, puck radius `PUCK_R = 20`.
- No time pressure on menus.
- No text-based gameplay instructions — language-independent by design.

## Potential Pain Points

1. Puck can reach `SPEED_CAP = 700` quickly after multiple paddle hits, leading to near-instant goals that feel unfair.
2. AI never misses when puck is slow — new players may struggle to score in early rounds.
3. No pause mechanism during PLAYING state.
4. Double score ad offer on DEAD screen may interrupt the retry flow.

## Recommendations

1. Add a brief aiming indicator on MENU showing paddle movement.
2. Introduce a short SERVING animation between goals so players can reorient.
3. Scale AI lag coefficient from ~0.04 (easy) to ~0.12 (hard) based on `score`.
4. Show round score (`playerGoals : aiGoals`) more prominently during play.
