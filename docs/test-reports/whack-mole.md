# Whack Mole — Test Report

## Summary
- **Game:** Whack Mole
- **Namespace:** `WhackMole`
- **Test Date:** 2026-06-21
- **Status:** PASS — No critical issues found

## Syntax Check
```bash
node --check whack-mole/js/game.js
# Exit 0 — no syntax errors
```

## Smoke Test Results
| Test | Result |
|---|---|
| Game loads to MENU | PASS |
| Tap starts gameplay | PASS |
| Score increments correctly | PASS |
| Lives decrements on failure | PASS |
| Game over screen appears | PASS |
| Best score persisted to `whackmole_best` | PASS |
| Restart via DEAD screen | PASS |
| AdManager.gameplayStart fires | PASS |
| AdManager.gameplayStop fires | PASS |
| Interstitial offered on game over | PASS |
| Double score offer appears | PASS |

## dt Clamp Fix (PR #22)
dt clamped to 0.05s — mole hitbox verified: tap on mole body (not just hole center) registers correctly. PR #22 fix.

## Performance
| Metric | Value |
|---|---|
| Target FPS | 60 fps |
| dt clamp | 50 ms max |
| Asset size | < 3 MB |

## Known Issues
- AudioContext may suspend on iOS first load — first tap resumes it automatically.
- localStorage unavailable in some cross-origin iframes — best score fails silently.
