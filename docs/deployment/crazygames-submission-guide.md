# CrazyGames Submission Guide — PixelNova Studios

## Overview

This guide covers how to prepare and submit any of the 100 mini-games or Orbit Hopper to CrazyGames, following their technical and quality requirements as of 2026.

---

## Prerequisites

1. CrazyGames developer account at portal.crazygames.com
2. Game passing all technical requirements below
3. Cover art ready: 512×512 (thumbnail) and 1280×720 (banner)
4. Game zipped with no external dependencies

---

## Technical Requirements Checklist

### Must-Pass (Rejection if missing)

- [ ] **No preloader screen** — Game must go directly to MENU on load. No splash screens, no "Loading..." screens. All our games start at `state = 'MENU'` in `init()`.
- [ ] **No external CDN dependencies** — All JS must be bundled in the zip. No calls to external APIs, analytics, or tracking. Our games are pure vanilla JS with no dependencies.
- [ ] **HTTPS-compatible** — No mixed content (http:// inside https://). Our games have no external requests.
- [ ] **Mobile-first** — Must work on touch devices. All our games use pointer events via `canvas.addEventListener('pointerdown', ...)`.
- [ ] **Portrait orientation** — 390×844 virtual canvas, letterboxed via CSS. ✅ All games comply.
- [ ] **60 FPS target** — rAF loop with `dt` clamped at 0.05s. ✅ All games comply after PR #22.
- [ ] **File size < 3 MB** — Pure JS + canvas, no images or audio files. ✅ All games well under 1 MB.
- [ ] **Canvas-only rendering** — No images, SVGs, or external fonts loaded. ✅ All art drawn in code.

### CrazyGames SDK Integration

- [ ] Add SDK script tag to `index.html` **before all game scripts**:
  ```html
  <script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>
  ```
- [ ] Set `config.adapter = 'crazygames'` in `js/ads.js`
- [ ] Verify `AdManager.gameplayStart()` called when PLAYING begins
- [ ] Verify `AdManager.gameplayStop()` called when player dies/wins
- [ ] Test interstitial fires after 3 runs (open DevTools, watch Console)

### Quality Requirements (Rejection if below bar)

- [ ] **Gameplay music** — Game must have audio playing during gameplay (not just sound effects)
- [ ] **Visual polish** — Smooth animations, no broken visual states
- [ ] **Game depth** — At least 2 minutes of engaging gameplay before becoming repetitive
- [ ] **Score system** — Clear scoring visible during play
- [ ] **Tutorial/onboarding** — Controls must be learnable in first 30 seconds

---

## Category Selection (Critical)

Wrong category = automatic rejection. Use this guide:

| If your game is... | Select category |
|-------------------|-----------------|
| Endless running/dodging/collecting | Arcade |
| Match-3, connect, logic puzzles | Puzzle |
| Memory, pattern recall | Casual |
| Physical skill, aiming, balancing | Skill |
| Word games | Word |
| Music/rhythm | Rhythm |
| Cards, board games | Card |
| Sports simulation | Sports |
| NOT "tap as fast as you can" | NOT Clicker |

> **Important:** Clicker = games where tapping IS the mechanic with no skill element (cookie clicker style). Arcade = skill-based games that happen to use tapping. Most of our games are Arcade or Casual.

---

## Step-by-Step Submission

### 1. Prepare the game folder

```bash
# Navigate to game directory
cd games/arrow-dodge

# Set CrazyGames adapter
# Edit js/ads.js: change 'null' to 'crazygames'

# Add SDK to index.html (before other scripts):
# <script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>

# Verify syntax
node --check js/game.js

# Test locally
python3 -m http.server 8889

# Open http://localhost:8889 in browser
# Play through: menu → start → play → die → ad offered
# Verify no console errors
```

### 2. Create cover art

For the thumbnail (512×512):
- Screenshot the game at peak visual moment
- Add game title text
- Use bright, saturated colors
- Avoid small text unreadable at thumbnail size

For the banner (1280×720):
- Wider composition showing gameplay
- Title + tagline
- Score or achievement visible if possible

Alternatively, use `orbit-hopper/promo.html` as reference for programmatic cover art generation.

### 3. Zip the game

```bash
# From the repo root
cd games
zip -r arrow-dodge.zip arrow-dodge/
# Result: arrow-dodge.zip containing arrow-dodge/index.html, arrow-dodge/js/*, etc.
```

The zip must contain `index.html` at the root of the zip (or one folder deep).

### 4. Upload to portal

1. Log in at portal.crazygames.com
2. Click "Add Game" → "Upload Game"
3. Upload the zip file
4. Fill in:
   - **Title:** (e.g., "Arrow Dodge")
   - **Category:** (use guide above — choose carefully)
   - **Description:** 100–200 words, focus on gameplay mechanic
   - **Tags:** (3–5 relevant tags)
5. Upload thumbnail (512×512) and banner (1280×720)
6. Set orientation: Portrait
7. Submit for review

### 5. After submission

- Review typically takes 3–7 business days
- Check email for acceptance or rejection notes
- If rejected for "quality," see improvement checklist below

---

## Rejection Handling

### "Overall quality does not meet publishing standards"
This is the most common rejection. Address in order:

1. **Add gameplay music** — Use Web Audio API oscillator sequencer (see orbit-hopper/js/audio.js `startGameMusic()` as reference)
2. **Add haptic feedback** — `navigator.vibrate()` at key events
3. **Add score milestones** — Celebration effect at scores 10, 25, 50, 100
4. **Deepen the mechanic** — Add one power-up or progression element
5. **Verify no broken states** — Play through 5 full sessions, die and retry each time

### "Preloader not allowed"
Set `state = 'MENU'` in the game's `init()` function. Remove any SPLASH state.

### "Wrong category"
Change category in the portal. No code changes needed.

### "Ad integration missing"
Ensure the CrazyGames SDK script is in index.html and `config.adapter = 'crazygames'` is set.

---

## Orbit Hopper Specific Notes

Orbit Hopper has been rejected once (15.06.2026, category: Clicker). Actions required:

1. **User action:** Change category in portal from "Clicker" → "Arcade"
2. **Code:** PR #23 merged — gameplay music, haptics, milestones, shield + slow-mo power-ups added
3. Resubmit with updated zip

The SPLASH screen has been removed (state starts at MENU). All quality criteria now met.

---

## Quality Self-Assessment Checklist

Rate your game 1–5 on each. Target average ≥ 3.5 for acceptance.

| Criterion | Score (1–5) |
|-----------|------------|
| First impression (menu screen) | |
| Controls feel responsive | |
| Audio (SFX + music) | |
| Visual feedback on actions | |
| Difficulty curve (not too hard/easy in first 60s) | |
| Game depth (stays interesting past 2 minutes) | |
| DEAD screen / retry flow | |

---

## After Acceptance

1. Monitor analytics in the CrazyGames portal (plays, session length, ad revenue)
2. Respond to player reviews within 48 hours
3. Update the game at least once per quarter to maintain visibility
4. Consider submitting to "Editor's Choice" after reaching 10K plays
