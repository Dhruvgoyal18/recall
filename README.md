# Recall

Manually save exactly what you choose — a text selection or a full page — from
Chrome, and browse everything you've saved, organized day by day, from a
dashboard you can reach on any device. Nothing is captured unless you click
"Save." Multi-user: anyone can sign up for their own account and gets a
private, isolated archive.

Full requirements: [`recall-extension-requirements-v3.md`](./recall-extension-requirements-v3.md).

## Architecture

```
[Chrome Extension] --HTTPS+JWT--> [Next.js on Vercel] --HTTPS+JWT--> [FastAPI on Railway] --> [Postgres]
```

- **`extension/`** — Manifest V3 extension. Manual capture only (context menu
  selection save, popup full-page save, configurable keyboard shortcut), with
  a `chrome.storage.local`-backed retry queue and a sign-in/sign-up UI (email
  + password) instead of manually-entered tokens. See [`extension/`](./extension).
- **`backend/`** — FastAPI service deployed on Railway (Docker web service,
  `railway.json` config in `backend/`). Postgres-backed, per-user-scoped
  storage, JWT session tokens, password hashing, rate limiting, structured
  logs. See [`backend/README.md`](./backend/README.md).
- **`frontend/`** — Next.js dashboard on Vercel. Day view, 30-day activity
  heatmap, search, delete, email+password sign-in, server-side API proxy so
  no backend secret ever reaches the browser. See [`frontend/README.md`](./frontend/README.md).

## Repo layout

```
recall/
  extension/     Chrome extension (TypeScript, esbuild)
  backend/       FastAPI backend (Python), deployed on Railway
  frontend/      Next.js dashboard (TypeScript), deployed on Vercel
  .github/workflows/   CI: extension build/lint/typecheck/test/package,
                       backend pytest, frontend lint/build/Playwright
```

## CI/CD

| Workflow | Triggers on | Does |
|---|---|---|
| `extension-build.yml` | changes under `extension/` | typecheck, lint, unit tests, build, packages a versioned `.zip` artifact |
| `backend-test.yml` | changes under `backend/` | pytest, Docker build smoke test |
| `frontend-test.yml` | changes under `frontend/` or `backend/` | lint, build, spins up the backend locally (SQLite) and runs Playwright against it |

Vercel auto-deploys previews per PR and promotes to production on merge to
`main`. Railway also auto-deploys the backend on push to `main` (the GitHub
App's repo access had silently dropped `recall` from its allowed
repositories, which is what caused the "Auto deploy unavailable — could not
load branches" state under Settings → Source; re-adding the repo at
github.com/settings/installations restored it). If auto-deploy ever shows
that error again, check the Railway App's repository access on GitHub first
before assuming the connection itself needs to be redone.

## One-time setup (secrets)

Each of Railway (`DATABASE_URL`, `JWT_SECRET`) and Vercel (`BACKEND_URL`) has
its own env vars — no secret is shared between them or with the extension,
since auth is now per-user (issued at signup/login), not a fixed shared
token. See `backend/README.md` and `frontend/README.md` for exactly which
variables go where.

## Local development

Run all three independently:

```bash
# backend (needs a local Postgres, or point DATABASE_URL at sqlite+aiosqlite for quick testing)
cd backend && pip install -r requirements-dev.txt
DATABASE_URL=postgresql+asyncpg://localhost/recall JWT_SECRET=dev-secret uvicorn app.main:app --reload --port 8000
alembic upgrade head

# frontend (separate terminal)
cd frontend && npm install
cp .env.example .env.local   # point BACKEND_URL at localhost:8000
npm run dev

# extension (separate terminal)
cd extension && npm install
npm run build   # then chrome://extensions -> Load unpacked -> extension/dist
```
