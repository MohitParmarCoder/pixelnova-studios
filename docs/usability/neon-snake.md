# Neon Snake — Usability Report

## Overview
- **Game:** Neon Snake
- **Genre:** Snake
- **Target audience:** Casual, all ages
- **Typical session length:** 2–5min
- **Learning curve:** Low

## First-Run Experience
The game loads directly to a MENU screen showing the game title and best score. A single large tap area initiates gameplay — there is no separate tutorial screen. The first few seconds naturally teach core mechanics through play.

## Control Scheme
- **Primary input:** Touch tap / mouse click (single touch)
- **Canvas size:** 390×844 virtual px — optimized for portrait mobile
- **Touch target sizes:** All interactive elements ≥ 44px diameter/width per accessibility guidelines
- **Drag support:** Where applicable (sliders, pad control) — touch drag tracked throughout frame

## UX Strengths
- Classic snake mechanics universally known\n- Neon trail gives satisfying length visualization
- Instant restart from DEAD screen with a single tap — minimal friction between runs
- Score and best score always visible in HUD
- Lives displayed as icon array — glanceable
- Particle effects and sound reinforce correct player actions
- Color palette ensures contrast between foreground elements and background
- Zero loading time — all assets are procedural canvas draws

## UX Weaknesses / Improvement Areas
- No tutorial overlay for first-time players — mechanics must be learned through play
- No pause functionality during PLAYING state
- No settings accessible during gameplay (only from MENU)
- No visual distinction between new best score and previous best until DEAD screen

## Accessibility Notes
- No text required for core gameplay (icons/numbers only in PLAYING state per CrazyGames policy)
- Color-only differentiation in some elements (potential issue for colorblind users)
- No sound required for gameplay — all critical information conveyed visually
- High-contrast neon palette on dark background aids legibility

## Mobile Usability
- Portrait orientation maintained — no rotation support needed
- Tap targets appropriately sized for thumbs
- Canvas CSS-scaled to fit any screen — no overflow or scroll
- AudioContext resume handled automatically on first user interaction

## Performance Perception
- 60 fps target — smooth animations create responsive feel
- dt clamped to 50ms — no hitches from tab-switch resume
- Particle effects provide satisfying feedback without overloading visual field
