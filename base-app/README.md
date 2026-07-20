# base-app

Minimal Vite + React starter. Standalone project — own `package.json`, no shared build step with the rest of the repo.

## Run locally

```bash
cd base-app
npm install
npm run dev       # dev server (Vite, hot reload)
npm run build     # production build to dist/
npm run preview   # serve the production build locally
```

## Deploy to Vercel

Vercel auto-detects Vite projects — no `vercel.json` needed.

```bash
cd base-app
npx vercel --prod
```

Or import this GitHub repo in the [Vercel dashboard](https://vercel.com/new), set **Root Directory** to `base-app`, and it will build/deploy automatically on every push.
