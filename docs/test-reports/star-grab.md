# Star Grab — Test Report

## Summary
- **Game:** Star Grab
- **Namespace:** `StarGrab`
- **Test Date:** 2026-06-21
- **Status:** PASS — No critical issues found

## Syntax Check
```bash
node --check star-grab/js/game.js
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
| Best score persisted to `stargrab_best` | PASS |
| Restart via DEAD screen | PASS |
| AdManager.gameplayStart fires | PASS |
| AdManager.gameplayStop fires | PASS |
| Interstitial offered on game over | PASS |
| Double score offer appears | PASS |

## dt Clamp Fix (PR #22)
dt clamped to 0.05s — max 1 life lost per frame from simultaneous expiring stars. PR #22 fix verified.

## Performance
| Metric | Value |
|---|---|
| Target FPS | 60 fps |
| dt clamp | 50 ms max |
| Asset size | < 3 MB |

## Known Issues
- AudioContext may suspend on iOS first load — first tap resumes it automatically.
- localStorage unavailable in some cross-origin iframes — best score fails silently.
