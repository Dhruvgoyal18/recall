# Recall Dashboard

Next.js (App Router) dashboard for Recall, deployed on Vercel. Proxies every
backend call through its own server-side API routes so the shared auth token
never reaches the browser bundle (§6.2 of the requirements doc).

## Required environment variables

See `.env.example`. All are server-side only — none are prefixed `NEXT_PUBLIC_`
except the optional Sentry DSN, which Sentry's own docs confirm is safe to
expose (it's a write-only ingest endpoint).

| Variable | Used by |
|---|---|
| `BACKEND_URL` | server — base URL of the FastAPI backend |
| `BACKEND_AUTH_TOKEN` | server — bearer token to the backend, and accepted from the extension |
| `DASHBOARD_PASSWORD` | server — single-user login (FR18) |
| `SESSION_SECRET` | server — HMACs the login session cookie |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | optional error tracking, blank disables it |

## Auth model

- Browser dashboard: `/login` sets a signed, httpOnly session cookie. `proxy.ts`
  gates every non-`/api` page and redirects to `/login` without it.
- Chrome extension: presents `Authorization: Bearer <BACKEND_AUTH_TOKEN>` on
  `/api/v1/*` calls. Each API route checks *either* the session cookie *or*
  that bearer token (`lib/require-auth.ts`) before proxying to the backend
  with the server-only token.
- `/api/health` is intentionally public — it's what a free uptime checker
  and the dashboard's own "backend unreachable" banner poll.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in real values
npm run dev
```

## Tests

```bash
npm run lint
npm run build
npm run test:e2e   # Playwright — starts its own `next start` unless PLAYWRIGHT_BASE_URL is set
```

## Deploy

Connect this repo to a Vercel project (root directory `frontend/`) and set the
environment variables above per-environment (Production/Preview/Development).
Vercel's native GitHub integration handles preview-per-PR and promote-on-merge
automatically — no custom deploy workflow needed.
