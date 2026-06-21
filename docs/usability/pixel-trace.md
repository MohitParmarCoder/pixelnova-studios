# Pixel Trace — Usability Report

## Overview
- **Game:** Pixel Trace
- **Genre:** Drawing Puzzle
- **Target audience:** Casual, creative
- **Typical session length:** 2–5min
- **Learning curve:** Low

## First-Run Experience
Loads directly to MENU with best score visible. Single tap starts gameplay. Core mechanic discovered in first 5–10 seconds through play.

## Control Scheme
- **Primary input:** Touch tap (single touch)
- **Canvas size:** 390×844 virtual px — optimized for portrait mobile
- **Touch targets:** All interactive elements ≥ 44px per accessibility guidelines

## UX Strengths
- Instant restart from DEAD screen — minimal friction between runs
- Score and lives always visible in HUD
- Particle effects and sound reinforce player actions
- Zero loading time — all art drawn procedurally on canvas
- High-contrast color palette against dark background

## UX Weaknesses / Improvement Areas
- No in-game tutorial — mechanics learned through trial and error
- No pause functionality during PLAYING state
- Settings only accessible from MENU

## Accessibility Notes
- Core gameplay information conveyed both visually and via sound
- Dark background with high-contrast elements aids legibility
- No image assets — all canvas-drawn, scales cleanly to any DPI

## Mobile Usability
- Portrait orientation maintained throughout
- Tap targets appropriately sized for thumb interaction
- Canvas CSS-scaled to fit any screen without scroll or overflow
- AudioContext auto-resumed on first user interaction
