# Recall Dashboard

Next.js (App Router) dashboard for Recall, deployed on Vercel. Proxies every
backend call through its own server-side API routes so no backend token
ever reaches the browser bundle.

## Required environment variables

See `.env.example`. All are server-side only — none are prefixed `NEXT_PUBLIC_`
except the optional Sentry DSN, which Sentry's own docs confirm is safe to
expose (it's a write-only ingest endpoint).

| Variable | Used by |
|---|---|
| `BACKEND_URL` | server — base URL of the FastAPI backend |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | optional error tracking, blank disables it |

## Auth model

Recall is multi-user: anyone can sign up for their own account and gets an
isolated archive. The backend (`backend/app/auth.py`) is the sole source of
truth — it hashes passwords, issues JWTs, and scopes every query by the
JWT's subject (user id). The frontend never holds a signing secret.

- Browser dashboard: `/signup` and `/login` call the backend's
  `/auth/signup` / `/auth/login` (via `lib/backend-client.ts`) and store the
  returned JWT directly as the `recall_session` cookie (httpOnly, signed
  implicitly by the JWT itself). `proxy.ts` gates every non-`/api` page,
  doing a light unverified expiry check on that JWT to decide whether to
  redirect to `/login` — the backend is what actually verifies the
  signature on every data call.
- Chrome extension: signs in via `/api/auth/login` (or `/api/auth/signup`),
  stores the returned JWT in `chrome.storage.local`, and presents it as
  `Authorization: Bearer <jwt>` on `/api/v1/*` calls.
- Each `/api/v1/*` route resolves the caller's own token — session cookie
  for the browser, bearer header for the extension (`lib/require-auth.ts`)
  — and forwards that same token to the backend, so the backend always
  scopes data to the real caller, not a shared secret.
- `/api/health` is intentionally public — it's what a free uptime checker
  and the dashboard's own "backend unreachable" banner poll.

## Local development

```bash
npm install
cp .env.example .env.local   # point BACKEND_URL at localhost:8000
npm run dev
```

## Tests

```bash
npm run lint
npm run build
npm run test:e2e   # Playwright — starts its own `next start` unless PLAYWRIGHT_BASE_URL is set
```

## Deploy

Connect this repo to a Vercel project (root directory `frontend/`) and set
`BACKEND_URL` (and optionally the Sentry vars) per-environment
(Production/Preview/Development). Vercel's native GitHub integration
handles preview-per-PR and promote-on-merge automatically — no custom
deploy workflow needed.
