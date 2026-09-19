# Recall — Operations & Runbook

This is the end-to-end reference for running Recall in production: architecture,
environments, deployment, day-to-day operations, incident runbooks, and the
Chrome Web Store release process. Component-level docs
([`backend/README.md`](../backend/README.md), [`frontend/README.md`](../frontend/README.md))
cover local dev and API details; this document is the operational layer on top.

## 1. Architecture

```
[Chrome Extension] --HTTPS+JWT--> [Next.js on Vercel] --HTTPS+JWT--> [FastAPI on Railway] --> [Postgres]
```

| Component | Stack | Hosting | Prod URL |
|---|---|---|---|
| Extension | Manifest V3, TypeScript, esbuild | Chrome Web Store (not yet published) | — |
| Frontend | Next.js (App Router) | Vercel | `https://recall-dashboard-five.vercel.app` |
| Backend | FastAPI, SQLAlchemy async, Alembic | Railway (Docker) | `https://recall-production-911c.up.railway.app` |
| Database | Postgres | Railway managed plugin | (internal, via `DATABASE_URL`) |

**Auth model**: the backend is the sole source of truth. It hashes passwords
(bcrypt, `passlib`, default cost factor) and issues HS256 JWTs with only
`sub` (user id) and `exp` claims — no `iat`/`iss`/`jti`. The frontend never
holds the signing secret:
- Browser: `/login`/`/signup` call the backend and store the JWT as an
  httpOnly `recall_session` cookie. `frontend/proxy.ts` does a light,
  **unverified** expiry check (base64url-decodes the payload, checks `exp`)
  purely for UX redirects — the backend verifies the signature on every
  actual data call.
- Extension: stores the JWT in `chrome.storage.local`, sends it as
  `Authorization: Bearer <jwt>`.
- Every `frontend/app/api/v1/*` route resolves the caller's own token
  (cookie or bearer, `lib/require-auth.ts`) and forwards *that* token to the
  backend — there is no shared/service token, so the backend always scopes
  data to the real caller.

## 2. Environments & repo layout

```
recall/
  extension/     Chrome extension (TypeScript, esbuild) — GitHub only, not auto-deployed
  backend/       FastAPI (Python) — Railway, root directory "backend", Dockerfile build
  frontend/      Next.js (TypeScript) — Vercel, root directory "frontend"
  .github/workflows/   CI: extension build/lint/typecheck/test/package,
                       backend pytest, frontend lint/build/Playwright
```

Single environment today: `main` → production on both Vercel and Railway.
There is no separate staging deploy; Vercel's per-PR previews are the closest
thing to a pre-prod environment for the frontend, and there's no equivalent
for the backend (see §7, "no staging environment" under Known Gaps).

## 3. Environment variables / secrets reference

| Var | Service | Required | Default | Notes |
|---|---|---|---|---|
| `DATABASE_URL` | backend | yes | — | `postgresql+asyncpg://...`; Railway's Postgres plugin provides the base URL, scheme must be adjusted to the asyncpg driver |
| `JWT_SECRET` | backend | yes | — | Signs/verifies all sessions. **Rotating it invalidates every existing session immediately** — no grace period, no key versioning (`backend/app/auth.py`) |
| `JWT_EXPIRES_DAYS` | backend | no | `30` | Session lifetime |
| `ALLOWED_ORIGINS` | backend | no | `http://localhost:3000` | Comma-separated CORS allowlist; must include the Vercel prod URL |
| `BACKEND_URL` | frontend | yes | — | Base URL the frontend proxies to |
| `SENTRY_DSN` | frontend | no | blank (disabled) | Server-side error tracking |
| `NEXT_PUBLIC_SENTRY_DSN` | frontend | no | blank (disabled) | Client-side error tracking; safe to expose (write-only ingest endpoint) |

Config is loaded via `pydantic-settings` (`backend/app/config.py`), cached
per-process with `@lru_cache` — **changing a Railway variable requires a
restart/redeploy to take effect**, not just a save.

No secret is shared between Railway, Vercel, and the extension — auth is
per-user (issued at signup/login), not a fixed shared token.

## 4. CI/CD

| Workflow | Triggers on | Does |
|---|---|---|
| `extension-build.yml` | changes under `extension/` | typecheck, lint, unit tests (vitest), build, packages a versioned `.zip`, uploads it as a GitHub Actions artifact (30-day retention) |
| `backend-test.yml` | changes under `backend/` | pytest (against throwaway SQLite via `aiosqlite`), Docker build smoke test |
| `frontend-test.yml` | changes under `frontend/` or `backend/` | lint, build, boots the backend locally (SQLite), runs Playwright e2e against it |

None of these publish anywhere — they gate PRs and produce build artifacts.
Actual deployment is handled entirely by Vercel's and Railway's own GitHub
integrations (see §5).

## 5. Deployment

**Frontend (Vercel)**: native GitHub integration — auto-deploys a preview
per PR, promotes to production on merge to `main`. No custom deploy step.

**Backend (Railway)**: auto-deploys on push to `main` via the Railway GitHub
App. **As of 2026-09-19 this is confirmed working end-to-end** — a push
triggers a build within seconds, no manual dashboard action required. See
§8.1 if it ever regresses; the failure mode looks identical to what we
already fixed once.

To manually verify a deploy went out: Railway dashboard → project
`sincere-eagerness` → `recall` service → **Deployments** tab, or hit
`GET /health` on the prod URL and check the response is live.

**Extension**: not continuously deployed. Releases are a manual, versioned
process — see §9.

## 6. Day-2 operations

### 6.1 Health & monitoring

- Backend: `GET /health` (public, no auth) — liveness check, also Railway's
  own `healthcheckPath` (`backend/railway.json`, 100s timeout, restarts on
  failure, max 10 retries).
- Frontend: `GET /api/health` (public, intentionally unauthenticated) —
  polled by the dashboard's own "backend unreachable" banner and suitable
  for an external uptime checker.
- No uptime monitoring is currently wired up externally — recommend
  pointing something like UptimeRobot/Better Uptime at both `/health`
  endpoints.
- Frontend errors: Sentry, only if `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` are
  set (currently optional/off by default). `tracesSampleRate: 0.1`, no PII
  scrubbing config, no release/environment tagging configured.
- Backend errors: no external error tracker — structured JSON logs only
  (see below).

### 6.2 Logs

- **Backend**: structured JSON to stdout only (`backend/app/logging_config.py`)
  — no file or external sink. Every request logs one line with `request_id`,
  `method`, `path`, `status`, `duration_ms`. View live via Railway dashboard
  → `recall` service → **Console**, or `railway logs` via the Railway CLI if
  installed locally.
- **Frontend**: Vercel's own function logs (Vercel dashboard → project →
  Logs), plus Sentry if enabled.
- **Extension**: no remote logging — `console.log` in the service worker,
  visible via `chrome://extensions` → Recall → "service worker" devtools
  link (only while the worker is active).

### 6.3 Rate limits

Keyed by JWT `sub` if a valid bearer token is present, else by IP
(`backend/app/rate_limit.py`). Exceeding returns `429`
`{"detail": "rate limit exceeded"}`.

| Endpoint | Limit |
|---|---|
| `POST /auth/signup` | 10/minute |
| `POST /auth/login` | 20/minute |
| `POST /v1/save` | 30/minute |
| `GET /v1/items` | 120/minute |
| `GET /v1/search` | 60/minute |
| `GET /v1/activity` | 60/minute |
| `DELETE /v1/item/{id}` | 30/minute |

If you see a spike in 429s in the logs, check for a misbehaving client
(e.g. the extension's retry queue thrashing — see §6.5) before assuming
abuse.

### 6.4 Database operations

- **Connecting**: use the `DATABASE_URL` from Railway's Postgres plugin
  Variables tab (swap to a sync-friendly `postgresql://` form for `psql`).
- **Migrations**: Alembic is authoritative (`backend/alembic/versions/` —
  currently a single migration, `6c4cde1d9b4e_initial_schema.py`, creating
  `users` and `items`). Apply with `alembic upgrade head` from `backend/`
  with `DATABASE_URL` set. The app also runs `Base.metadata.create_all` on
  startup as a first-boot safety net, but that is **not** a substitute for
  running Alembic when you change the schema.
- **New migrations**: `alembic revision --autogenerate -m "..."` after
  editing `app/db_models.py`, review the generated file, commit it, then run
  `alembic upgrade head` against production once deployed.
- **Backups**: Railway exposes a **Backups** tab per service (confirmed
  present on the `recall` service view) for volume/database snapshots —
  check the equivalent tab on the `Postgres` service and confirm retention
  is configured; this hasn't been independently verified as active.
- **One-time import script**: `backend/scripts/migrate_to_postgres.py` —
  only relevant if ever re-importing from the old single-tenant JSONL
  backend. Not part of normal operations.

### 6.5 Extension offline retry queue

`extension/src/background/service-worker.ts` + `shared/queue.ts`: failed
saves are enqueued to `chrome.storage.local` and retried on a 1-minute
alarm, with exponential backoff (`5s * 2^attempts`, capped at 5 minutes).
A `401` halts the flush pass, clears the stored token, and requeues
remaining items (the user needs to sign in again). **There is no max-attempt
cap or eviction** — a permanently-failing item (e.g. backend down for days,
or a deleted account) retries forever at the 5-minute ceiling. If a user
reports a stuck/growing queue, the Options page has a "Flush queue" button
that surfaces flushed/remaining counts; worst case, "Sign out" clears the
token (queue items remain, will resume once signed back in).

### 6.6 Rotating secrets

- `JWT_SECRET`: rotating it **logs out every user immediately** (no grace
  period). Only do this for a suspected compromise, and warn users first if
  possible.
- `DATABASE_URL`: only changes when migrating databases/hosts; update in
  Railway Variables and redeploy.
- `ALLOWED_ORIGINS`: update if the Vercel domain ever changes (e.g. a custom
  domain is added) — CORS will silently reject the frontend otherwise.

### 6.7 User account deletion (manual — no tooling exists)

The privacy policy (`frontend/app/privacy/page.tsx`) promises manual account
deletion on request, but **there is no admin endpoint, script, or CLI for
it** — only per-item soft-delete (`deleted` flag) is exposed to end users.
Until this is built, deleting a user on request means running SQL directly
against Postgres:

```sql
-- take a backup first
DELETE FROM items WHERE user_id = '<user-id>';
DELETE FROM users WHERE id = '<user-id>';
```

This is a real operational gap — see §10.

## 7. Known gaps / TODOs

- **No account-deletion tooling** (§6.7) — should become a real admin
  endpoint or script before this scales past manual, ad hoc requests.
- **No staging environment** — every push to `main` goes straight to
  production on both Vercel and Railway.
- **`JWT_SECRET` rotation has no grace period** — any rotation is a hard
  logout for all users, by design of the current single-secret HS256 setup.
- **Extension retry queue has no max-attempt cap** — permanently-broken
  items retry forever.
- **Single Railway replica** — no horizontal scaling or failover configured;
  a crash triggers Railway's restart policy (max 10 retries) rather than
  serving traffic from elsewhere in the meantime.
- **No external uptime monitoring** wired up yet, despite both `/health`
  endpoints being designed for it.

## 8. Incident runbooks

### 8.1 Railway shows "Auto deploy unavailable — could not load branches"

**This happened and was fixed on 2026-09-19.** Root cause: the Railway
GitHub App's repository access on GitHub had silently narrowed to a
different, unrelated repo — `recall` had been dropped from its allowed
repositories list, even though the app was still "installed" on the
account. Railway's UI reported this as a vague branch-loading error rather
than a clear permissions error.

Fix, in order of likelihood:
1. GitHub → `https://github.com/settings/installations` → **Railway App** →
   **Configure**. Under "Repository access" → "Only select repositories",
   confirm `<owner>/recall` is in the list. If it's missing, add it via
   "Select repositories" and **Save**. GitHub redirects back to Railway
   automatically (`railway.com/auth/github-installation-setup?...`).
2. Back in Railway → `recall` service → Settings → Source, the "Auto deploy
   unavailable" banner should now show a working **Enable/Disable** toggle
   for "Auto deploys when pushed to GitHub." Click Enable if it's off.
3. The branch-list error itself ("Could not load branches. Retry") may
   persist as a cosmetic issue even after the fix — it only affects the
   branch-switcher dropdown, not the actual deploy trigger. Don't treat it
   as a sign the fix didn't work; verify with a real push instead (see next
   step).
4. Verify: push a trivial commit to `main` and confirm a new deployment
   appears automatically in the Deployments tab within ~30 seconds, without
   using the manual "Apply changes → Deploy" workaround.
5. If step 1 shows `recall` already listed and correctly scoped, the
   problem is elsewhere (stale Railway-side token) — try Settings → Source →
   **Disconnect** then reconnect via the repo picker, re-setting **Root
   Directory** to `backend`.

### 8.2 Frontend shows "backend unreachable"

The dashboard's banner is driven by `GET /api/health`, which itself proxies
`backend-client.ts`'s health check — a plain `fetch` with **no timeout and
no retries**; any network error becomes a `503`. Check, in order: Railway
service is Online (not crash-looping), `BACKEND_URL` on Vercel matches the
current Railway domain, and `ALLOWED_ORIGINS` on Railway includes the
Vercel domain (a CORS mismatch can look identical to "unreachable" from the
browser).

### 8.3 Spike in 401s or users unexpectedly logged out

Check whether `JWT_SECRET` was recently changed (§6.6) — this is the only
thing that invalidates all sessions at once. Otherwise check `JWT_EXPIRES_DAYS`
wasn't accidentally lowered.

### 8.4 Spike in 429s

Cross-reference the rate limit table (§6.3) against which endpoint is
spiking. `/v1/save` spikes often trace back to the extension's retry queue
retrying too aggressively after an outage recovers (many users' 5-minute
backoff timers firing in the same window) rather than actual abuse.

## 9. Chrome Web Store release process

The extension is not yet published; this is both the first-release checklist
and the process for every version after that.

**Every release:**
1. Bump `version` in both `extension/manifest.json` and `extension/package.json`
   (keep them in sync — nothing enforces this automatically).
2. `cd extension && npm run package` — runs typecheck/build implicitly via
   `build.mjs`, then zips `dist/` into `recall-extension-v<version>.zip`.
   Source maps are stripped from this build (`sourcemap` is only enabled
   under `--watch`) — confirm with `unzip -l` that no `.map` files are
   present before uploading.
3. Alternatively, grab the already-built zip from the `extension-build.yml`
   GitHub Actions run for that commit (artifact name `recall-extension`,
   30-day retention) instead of building locally.
4. Sanity-check by loading the unpacked `dist/` in `chrome://extensions`
   (Developer mode → Load unpacked) and exercising save-selection,
   save-full-page, options, and sign-in before uploading anywhere.

**First submission only:**
1. Register a developer account at `chrome.google.com/webstore/devconsole`
   (one-time $5 fee).
2. Upload the zip, then fill in the listing:
   - **Privacy policy URL**: the deployed `/privacy` page on the frontend
     (`https://recall-dashboard-five.vercel.app/privacy`).
   - **Single purpose description**: manually save a text selection or full
     page to your own private, per-account Recall archive; nothing is
     captured automatically.
   - **Permission justifications** (copy for the review form):
     - Broad host permissions / all-URLs content script: the extension must
       run on any page the user manually chooses to save from, and the
       backend URL is user-configurable for self-hosting, so it can't be
       scoped to one fixed domain.
     - `scripting`: fallback re-injection of the content script into tabs
       that were already open at install/update time.
     - `storage`: stores the user's backend URL, session token, and offline
       retry queue locally on-device.
     - `alarms`: periodically retries saving items that failed while
       offline.
     - `contextMenus`: adds the right-click "Save selection to Recall"
       entry.
   - Screenshots/promo tile: not yet produced — capture at least one
     1280×800 screenshot of the popup/dashboard in use, plus a 440×280
     promo tile.
3. Submit for review. Given the broad host permissions plus auth/data
   handling, expect a possible manual follow-up email from the review team
   — answer with the same justification text above.

**Subsequent versions**: repeat the "every release" steps, then upload the
new zip as a new version in the same Developer Dashboard listing (no
justification re-submission needed unless permissions changed).

## 10. Priority follow-ups

Roughly in order of operational risk:

1. Build real account-deletion tooling (§6.7) — currently a manual SQL
   workaround, and the privacy policy already promises this on request.
2. Wire up external uptime monitoring against both `/health` endpoints
   (§6.1).
3. Verify Railway Postgres backups are actually configured and test a
   restore at least once (§6.4).
4. Consider a max-attempt cap for the extension's offline retry queue
   (§6.5) so permanently-failing items don't retry forever.
5. Publish the extension to the Chrome Web Store (§9) — code-side prep is
   done as of `1.0.1`; only the account/listing steps remain.
