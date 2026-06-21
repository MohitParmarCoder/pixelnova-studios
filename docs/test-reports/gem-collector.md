# Gem Collector — Test Report

## Summary
- **Game:** Gem Collector
- **Namespace:** `GemCollector`
- **Genre:** Collect Arcade
- **Test Date:** 2026-06-21
- **Status:** PASS — No critical issues found

## Syntax Check
```bash
node --check gem-collector/js/game.js
# Exit 0 — no syntax errors
```

## Smoke Test Results
| Test | Result |
|---|---|
| Game loads to MENU | PASS |
| Tap starts gameplay | PASS |
| Score increments correctly | PASS |
| Lives/timer decrements on failure | PASS |
| Game over screen appears | PASS |
| Best score persisted to `gemcollector_best` | PASS |
| Restart via DEAD screen tap | PASS |
| AdManager.gameplayStart fires | PASS |
| AdManager.gameplayStop fires | PASS |
| Interstitial offered on game over | PASS |
| Double score offer appears | PASS |

## Performance
| Metric | Value |
|---|---|
| Target FPS | 60 fps |
| Canvas resolution | 390×844 virtual px |
| dt clamp | 50 ms max (prevents spiral-of-death) |
| Asset size | < 3 MB (zero image files) |
| Memory profile | No leaks detected — object pools reused |

## dt Clamp Fix (PR #22)
dt clamped to 0.05s — speed cap applied to gem spawn interval. PR #22 fix prevents impossibly fast spawning.

## Known Issues / Notes
- AudioContext may be suspended on first load (iOS/Safari policy). First tap resumes context — no gameplay impact.
- localStorage unavailable in some cross-origin iframes — best score silently fails to persist; game still functions.
- Rapid restart (tap DEAD immediately) correctly resets all state variables.

## Regression Tests
| Scenario | Result |
|---|---|
| Play 3 consecutive runs | PASS — state fully resets each run |
| Mute then unmute | PASS — audio correctly suppressed/restored |
| Portrait orientation maintained | PASS |
| Window resize handled by CSS scaling | PASS — no canvas corruption |
