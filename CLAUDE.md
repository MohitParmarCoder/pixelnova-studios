# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

Unrelated projects live side by side:

1. **DailyNews** (repo root) — a Create React App project from a Udemy fullstack course, in early scaffolding stage.
2. **Orbit Hopper** (`orbit-hopper/`) — a standalone, complete HTML5 canvas game with no build step.
3. **PixelNova Studios website** (`company-website/`) — standalone company landing page, no build step.
4. **base-app** (`base-app/`) — a minimal Vite + React starter, standalone with its own `package.json`.

## DailyNews (React app)

### Commands

```bash
npm start          # dev server at http://localhost:3000
npm test           # Jest in watch mode (react-scripts test)
npm test -- --watchAll=false src/path/to/file.test.js   # single test file, one-shot
npm run build      # production build to build/
```

### Architecture

- CRA (react-scripts 4) with React 17, React Router v5 (`Switch`/`Route` API, not v6), Redux + redux-promise, react-bootstrap 4, axios, react-toastify.
- Entry: `src/index.js` → `src/routes.js` (all routing lives here) → `src/components/`.
- Components use a folder-per-component pattern with `index.js` (e.g. `src/components/home/index.js`).
- `src/store/index.js` and `src/store/types.js` are placeholders — Redux is installed but not yet wired up; the store is not connected in `src/index.js`.
- Note: react-scripts 4 may need `NODE_OPTIONS=--openssl-legacy-provider` on Node 17+.

## Orbit Hopper (`orbit-hopper/`)

Vanilla JS + Canvas2D one-touch arcade game. Zero build step, zero npm dependencies — never add a framework or bundler to it.

### Run & test

```bash
python3 -m http.server 8080 --directory orbit-hopper   # serve at http://localhost:8080
node --check orbit-hopper/js/game.js                   # syntax check (run after every edit)
node orbit-hopper/smoke-test.js                        # headless smoke test (no browser needed)

# E2E (requires a running server on :8080 and playwright installed globally):
NODE_PATH=$(npm root -g) node orbit-hopper/test/e2e.js
# E2E with video recording:
RECORD_DIR=/tmp node orbit-hopper/test/e2e.js
```

### Architecture

Script load order in `index.html` is the dependency graph — each file is an IIFE exposing one global:

```
audio.js (Audio) → ads.js (AdManager) → input.js (Input) → ui.js (UI) → game.js (Game) → main.js
```

- **main.js** — bootstraps all modules, runs the rAF loop (`dt = min((ts−prev)/1000, 0.05)`), pauses on `visibilitychange`. Letterboxes the virtual 390×844 canvas via CSS `width`/`height` scaling.
- **game.js** — the entire game: state machine, physics, rendering (~1400 lines). All coordinates in virtual-canvas space.
- **audio.js** — embeds ZzFX (MIT) inline. Sounds pre-rendered at init into `_bufs`. Also provides an oscillator-based ambient drone (`startAmbient()` / `stopAmbient()`) for the menu. AudioContext is lazy + try/catch-guarded for mobile policy.
- **ads.js** — `config.adapter` at the top switches between `'null'` (default), `'crazygames'`, `'gamedistribution'`. Interstitial frequency cap (1 per 3 runs, 60 s gap) is enforced in `AdManager.showInterstitial`, not in adapters.
- **input.js** — unified pointer/keyboard → virtual-canvas coords. Exposes `consumePress()`, `isDown()`, `lastPos()`.
- **ui.js** — icon drawing primitives (all icons are canvas-drawn paths, no images).

### State machine

```
SPLASH → MENU ⇄ INFO
              ⇄ SETTINGS (overlay, settingsOpen flag, not a true state)
              → PLAYING → DYING → RESULTS → (retry → PLAYING, via restartGame)
```

`SPLASH` shows the PixelNova Studios branding for ~2.6 s (tap to skip). `INFO` is the how-to-play screen (4 animated cards). `SETTINGS` is a full-screen overlay drawn on top of `MENU` controlled by `settingsOpen` boolean rather than `state`.

### Key game.js internals

- `dynGravR(p)` — gravity ring radius that shrinks from level 4+: `p.r * max(2.3, GRAV_MULT − diffLv*0.07)`. Used in both hit-detection and the ring draw; pass it through `dynGravR` whenever checking gravity capture or drawing the ring.
- `launchSpd()` / `orbitSpd()` — scale with `diffLv`. Difficulty level increments every `DIFF_STEP` (8) score points.
- `maxLevel` — highest `diffLv` ever reached, persisted to `orbit_maxlevel`. Updated in `land()` when `diffLv > maxLevel`.
- `drawNovaLogo(cx, cy, r, rot)` — shared 8-point star drawing helper, used in both `drawSplash()` and `drawSettings()`.
- Public API (test hooks): `Game.getState()`, `Game.getScore()`.

### localStorage keys

| Key | Content |
|-----|---------|
| `orbit_best` | highest score |
| `orbit_runs` | total runs played |
| `orbit_muted` | `'1'` = muted |
| `orbit_maxlevel` | highest `diffLv` reached |

### Hard constraints (portal acceptance)

- No image files — all art drawn in canvas code.
- Icons + numerals only in gameplay UI (no words during PLAYING/DYING/RESULTS).
- 60 fps / < 3 MB budget.
- **The `SPLASH` state violates CrazyGames/GD "no preloader" policy.** Before portal submission, remove or skip the SPLASH state (set `state = 'MENU'` in `init()` and delete `updateSplash`/`drawSplash`).

### Promo & portal submission

`orbit-hopper/promo.html` renders 512×512 and 1280×720 cover art for store listings. See `orbit-hopper/README.md` for ad-SDK swap instructions and portal submission checklists.

## PixelNova Studios website (`company-website/`)

Standalone single-file HTML page — no build step, no dependencies. Serves via any static file server or rawcdn.githack.com. The animated canvas logo uses the same `drawNova()` drawing logic as `orbit-hopper/js/game.js`'s `drawNovaLogo()` — keep them in sync if the logo design changes.

```bash
python3 -m http.server 9000 --directory company-website   # serve at http://localhost:9000
```

## base-app (`base-app/`)

Minimal Vite + React starter, scaffolded via `npm create vite@latest -- --template react`. Standalone — own `package.json`/lockfile, no shared build step or dependencies with the rest of the repo. Vercel auto-detects Vite, no `vercel.json` needed.

```bash
cd base-app
npm install
npm run dev       # dev server (Vite, hot reload)
npm run build     # production build to dist/
npm run preview   # serve the production build locally
npx vercel --prod # deploy (or import the repo in the Vercel dashboard, root dir = base-app)
```
