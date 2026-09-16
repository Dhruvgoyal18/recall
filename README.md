# Recall

Manually save exactly what you choose — a text selection or a full page — from
Chrome, and browse everything you've saved, organized day by day, from a
dashboard you can reach on any device. Nothing is captured unless you click
"Save."

Full requirements: [`recall-extension-requirements-v3.md`](./recall-extension-requirements-v3.md).

## Architecture

```
[Chrome Extension] --HTTPS+token--> [Next.js on Vercel] --HTTPS+token--> [FastAPI on Railway] --> [HF Hub Dataset repo]
```

- **`extension/`** — Manifest V3 extension. Manual capture only (context menu
  selection save, popup full-page save, configurable keyboard shortcut), with
  a `chrome.storage.local`-backed retry queue. See [`extension/`](./extension).
- **`backend/`** — FastAPI service deployed on Railway (Docker web service,
  `railway.json` config in `backend/`). Durable local write to a persistent
  Railway Volume + buffered batched commits to a Hugging Face Hub Dataset
  repo as backup, token auth, rate limiting, structured logs. See
  [`backend/README.md`](./backend/README.md).
- **`frontend/`** — Next.js dashboard on Vercel. Day view, 30-day activity
  heatmap, search, delete, single-user password gate, server-side API proxy
  so the backend token never reaches the browser. See [`frontend/README.md`](./frontend/README.md).

## Repo layout

```
recall/
  extension/     Chrome extension (TypeScript, esbuild)
  backend/       FastAPI backend (Python), deployed on Railway
  frontend/      Next.js dashboard (TypeScript), deployed on Vercel
  .github/workflows/   CI: extension build/lint/typecheck/package,
                       backend pytest, frontend lint/build/Playwright
```

## CI/CD

| Workflow | Triggers on | Does |
|---|---|---|
| `extension-build.yml` | changes under `extension/` | typecheck, lint, build, packages a versioned `.zip` artifact |
| `backend-test.yml` | changes under `backend/` | pytest, Docker build smoke test |
| `frontend-test.yml` | changes under `frontend/` or `backend/` | lint, build, spins up the backend locally and runs Playwright against it |

The backend and frontend deploy themselves natively (Railway auto-deploys on
push to `main` once the GitHub repo is connected; Vercel auto-deploys previews
per PR and promotes to production on merge to `main`) — no custom deploy
workflow needed for either.

## One-time setup (secrets)

A single shared `AUTH_TOKEN`/`BACKEND_AUTH_TOKEN` value is used in three
places — the extension's Options page, the Vercel `BACKEND_AUTH_TOKEN` env
var, and Railway's `AUTH_TOKEN` environment variable. Generate strong random
values for that token, the dashboard password, and the session-cookie secret;
see `frontend/.env.example` and `backend/README.md` for exactly which
variables go where.

## Local development

Run all three independently:

```bash
# backend
cd backend && pip install -r requirements-dev.txt
AUTH_TOKEN=dev-token uvicorn app.main:app --reload --port 8000

# frontend (separate terminal)
cd frontend && npm install
cp .env.example .env.local   # point BACKEND_URL at localhost:8000
npm run dev

# extension (separate terminal)
cd extension && npm install
npm run build   # then chrome://extensions -> Load unpacked -> extension/dist
```
