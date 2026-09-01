# Leverage — Time Coach (deployable scaffold)

This turns the Claude.ai artifact prototype (`leverage_time_coach.jsx`) into
a real, standalone app: a static React frontend + a tiny backend that holds
the Anthropic API key and proxies `/v1/messages`. The frontend never talks
to `api.anthropic.com` directly anymore — it calls its own backend at
`POST /api/coach`.

## Layout

```
leverage-app/
  frontend/            Vite + React app. frontend/src/LeverageApp.jsx is the
                        original component, unchanged except the fetch now
                        points at "/api/coach" instead of the Anthropic API.
  server/               Express backend — deploy this if you want a single
                        long-running Node process (Render, Railway, Fly.io,
                        a VPS, etc.)
  api/coach.js           Same proxy logic, packaged as a Vercel serverless
                        function — deploy this path if you'd rather use
                        Vercel and skip running your own server.
  server/coachHandler.js The actual proxy logic (validation + the call to
                        Anthropic). Both server/index.js and api/coach.js
                        import this one file, so there's only one place to
                        edit if you change the model, token limit, or
                        validation rules.
  vercel.json            Tells Vercel to build the frontend and wire up
                        api/coach.js.
```

You only need **one** of `server/` or `api/coach.js` running in production,
not both — pick based on where you deploy (see below).

## Local development

```bash
# from leverage-app/
cp .env.example .env        # then paste your real ANTHROPIC_API_KEY into .env
npm run install:all

# terminal 1
npm run dev:server          # Express on http://localhost:3000

# terminal 2
npm run dev:frontend        # Vite on http://localhost:5173, proxies /api to :3000
```

Open http://localhost:5173 — the app behaves exactly as it did as a
claude.ai artifact, but now it's calling your own backend.

## Deploying

### Option A — Vercel (simplest, no server to manage)

1. Push this folder to a GitHub repo, import it into Vercel.
2. In the Vercel project's Environment Variables, set
   `ANTHROPIC_API_KEY` to your real key.
3. Vercel reads `vercel.json`: it builds `frontend/` and deploys
   `api/coach.js` as a serverless function automatically. No changes
   needed.
4. You can delete or ignore `server/` for this path — it's not used.

### Option B — A regular Node host (Render, Railway, Fly.io, a VPS)

1. Set `ANTHROPIC_API_KEY` as an environment variable on the host.
2. Build step: `npm run build:frontend` (produces `frontend/dist`, which
   `server/index.js` serves as static files).
3. Start command: `npm start` (runs `server/index.js`, which serves the
   built frontend *and* answers `POST /api/coach` on the same origin —
   one process, one URL).
4. Most platforms (Render, Railway) auto-detect this from `package.json`
   scripts; for a bare VPS just run those two commands yourself behind
   whatever process manager / reverse proxy you use.

### The QR code in the physical planner

Point the physical planner's QR code at a domain/redirect **you control**
(e.g. a short link or a subdomain you own), not directly at whatever
`*.vercel.app` or `*.onrender.com` URL you start with. That way if you ever
move hosts or add Level 1/3/4 under a different URL structure, you repoint
the redirect instead of reprinting the planner.

## Security notes

- The real API key lives only in the backend's environment variables. It
  is never sent to the browser.
- `server/coachHandler.js` validates the request shape (message count,
  message length, system-prompt length) before forwarding to Anthropic,
  and `server/index.js` adds a simple per-IP rate limit. Both are
  intentionally conservative starting points — tighten them if this gets
  real traffic (e.g. move rate limiting to a shared store if you run
  multiple instances).
- CORS isn't opened up — the frontend and `/api/coach` are meant to be
  served from the same origin (that's what both deploy options above do),
  so no cross-origin config is needed.

## What's NOT changed

`frontend/src/LeverageApp.jsx` is otherwise untouched from the artifact
version — same components, same client-side logic, same design decisions
documented in the original README (deterministic checks in JS, queued
coach calls, blur-not-keystroke triggers, etc.). Only the one `fetch` call
was repointed.
