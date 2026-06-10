# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

Two unrelated projects live side by side:

1. **DailyNews** (repo root) — a Create React App project from a Udemy fullstack course, in early scaffolding stage.
2. **Orbit Hopper** (`orbit-hopper/`) — a standalone, complete HTML5 canvas game with no build step and no dependency on the React app.

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

### Run

```bash
python3 -m http.server 8080 --directory orbit-hopper   # then open http://localhost:8080
node --check orbit-hopper/js/game.js                   # syntax check (no test suite)
```

### Architecture

Script load order in `index.html` matters — each file is an IIFE exposing one global, consumed by later scripts: `audio.js` (Audio) → `ads.js` (AdManager) → `input.js` (Input) → `ui.js` (UI) → `game.js` (Game) → `main.js` (bootstrap + rAF loop).

- **game.js** is the core: a state machine (`MENU → PLAYING → DYING → RESULTS`) on a fixed virtual canvas of 390×844, letterboxed by `main.js`. All coordinates are in virtual-canvas space; `input.js` converts pointer events into it.
- **ads.js**: `config.adapter` at the top switches between `'null'` (default, fully playable), `'crazygames'`, and `'gamedistribution'` — the latter two are stubs with TODO comments at real SDK call sites. Interstitial frequency caps (1 per 3 runs, 60 s minimum gap) are enforced in `AdManager.showInterstitial`, not in adapters.
- **audio.js** embeds ZzFX (MIT) and pre-renders all SFX buffers at init; sounds are referenced by name (`Audio.play('hop')`).
- Hard constraints (portal acceptance): no text/words in gameplay UI (icons + numerals only), no image files (all art is drawn in code), no splash/preloader, 60 fps / <3 MB budgets.
- localStorage keys: `orbit_best`, `orbit_muted`, `orbit_runs`.

`promo.html` is a standalone page that renders 512×512 and 1280×720 cover art on canvas for portal submissions. See `orbit-hopper/README.md` for ad-SDK swap instructions and portal submission checklists.
