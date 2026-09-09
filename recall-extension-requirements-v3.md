# Recall — Chrome Extension Requirements Document (v3, Production-Ready)

## 1. Updated Goal

Build a Chrome extension that lets the user **manually save only the exact content
they choose** — a text selection on any page, or the full readable content of the
current page — with one click / one right-click. Saved items are sent to a backend
API deployed on a **Hugging Face Space** (FastAPI), which persists everything to a
**Hugging Face Hub Dataset repo**. A **Next.js web dashboard deployed on Vercel** lets
the user browse everything they've saved, **organized day by day**, with search and
delete — built and deployed to production-grade standards (secure, monitored,
reliable, CI/CD-driven).

Nothing is captured automatically or silently. If the user didn't click "Save," it
doesn't exist in Recall.

## 2. What Changed from v2

| Area | v2 | v3 (this doc) |
|---|---|---|
| Dashboard/frontend | Streamlit on Hugging Face Spaces | **Next.js app deployed on Vercel** |
| Frontend↔backend link | Same-Hub, mostly trusted context | **Cross-origin over the public internet — CORS, auth, and rate limiting now load-bearing, not optional** |
| Readiness bar | MVP / personal script | **Production-ready**: CI/CD, monitoring, secrets management, error handling, versioned API |

Backend (FastAPI on Hugging Face Space) and storage (Hugging Face Hub Dataset repo)
are unchanged from v2 — only the presentation layer and the production-hardening
requirements are new.

## 3. Core Principle: Selection Is Consent (unchanged)

- The extension never reads, stores, or transmits page content unless the user takes
  one of two explicit actions:
  1. **"Save Selection"** — highlight text on any page, save just that text.
  2. **"Save Full Page"** — explicitly save the full readable content of the page.
- No background monitoring of scrolling, dwell time, or navigation for capture.

## 4. Core User Stories (unchanged, +1)

1. User highlights a paragraph from a Claude conversation, right-clicks → "Save to
   Recall."
2. User finishes a Medium article, clicks the Recall toolbar icon → "Save Full Page."
3. Days later, user opens the **Recall dashboard at their own Vercel URL** (e.g.
   `recall.yourdomain.com`), picks a date, sees everything saved that day.
4. User searches the dashboard for a keyword and finds a saved snippet regardless of
   which day it was saved.
5. **New:** User accesses the dashboard from any device (phone, another laptop) since
   it's a real deployed web app, not a local script — and it's protected by login so
   only they can see their data.

## 5. Functional Requirements

### 5.1 Chrome Extension — Capture (unchanged from v2)

- FR1: Context menu action "Save selection to Recall" on any right-click with a text
  selection.
- FR2: Toolbar popup button "Save Full Page" — readability-style extraction of the
  current tab's content.
- FR3: Configurable keyboard shortcut for "Save Selection."
- FR4: Every save captures: content, page URL, title, timestamp, capture type
  (`selection` | `full_page`), domain.
- FR5: Confirmation toast with Undo.
- FR6: Local retry queue in extension storage if the backend is unreachable.
- FR7: Options page: backend API URL, auth token, sync status.

### 5.2 Backend (FastAPI on Hugging Face Space) — unchanged core, hardened (see §6)

- FR8: `POST /save`, `DELETE /item/{id}`, `GET /items?date=YYYY-MM-DD`, plus
  `GET /search?q=...` (used by the Vercel frontend).
- FR9: Token-based auth on every request (extension and frontend both authenticate).
- FR10: Storage on a Hugging Face Hub Dataset repo, JSONL partitioned by date
  (`data/YYYY-MM-DD.jsonl`).
- FR11: Buffered/batched commits to the Hub to respect rate limits and keep latency
  low for the caller.
- FR12: Every explicit save is kept as its own record (no aggressive dedup).

### 5.3 Frontend Dashboard — Next.js on Vercel (replaces Streamlit)

- FR13: **Day-wise view (primary):** date picker (defaults to today), fetches that
  day's items from `GET /items?date=...`, renders as cards (title, domain, capture
  type icon, expandable content preview, timestamp, link to source).
- FR14: **Activity strip/heatmap** of the last 30 days (counts per day), clicking a day
  jumps the date picker.
- FR15: **Keyword search** across all items via `GET /search?q=...`, independent of
  date.
- FR16: Filters by capture type and domain.
- FR17: Delete action from the UI, calling `DELETE /item/{id}`.
- FR18: **Authentication on the dashboard itself** — since it's now a publicly
  reachable Vercel URL, it must not be openly browsable by anyone who finds the link.
  v1 approach: a single-user password/passkey gate (e.g., NextAuth with a single
  credential, or a simple signed-cookie password wall) — this is a personal tool, not
  multi-tenant, so full user-account infra is unnecessary.
- FR19: Responsive layout (usable on mobile) since it's now a real deployed site.
- FR20: Loading states, empty states, and clear error states (e.g., "backend
  unreachable" banner rather than a blank page).

## 6. Production Readiness Requirements

This is the section that makes this "deployable for real" rather than a personal
script, per your request.

### 6.1 Security
- All traffic over HTTPS everywhere (Vercel and Hugging Face Spaces both provide this
  by default — verify it's enforced, not just available).
- **CORS:** backend must explicitly allow only the deployed Vercel origin(s) (and
  `localhost` for dev) — not `*`.
- **Auth token** stored as: a Hugging Face Space secret (backend), a Vercel
  environment variable (frontend, used server-side only — never shipped to the
  browser bundle), and in the extension's `chrome.storage` (encrypted at rest by
  Chrome itself).
- Backend validates and sanitizes all input (length limits on content, URL format
  validation) to guard against abuse/injection, even though it's single-user — the
  endpoint is still internet-facing.
- Rate limiting on the backend (e.g., simple in-memory or Redis-backed limiter) to
  prevent runaway extension bugs or malicious hits from hammering the Hub API.
- Dashboard auth (FR18) gates all routes, including API proxy routes if the Next.js
  app proxies requests to the backend rather than calling it directly from the
  browser (recommended — see 6.2).

### 6.2 Architecture Hardening
- **Recommended:** the Next.js app's API routes (server-side) proxy calls to the
  Hugging Face backend, rather than the browser calling the HF Space directly. This
  keeps the backend auth token server-side only, avoids exposing it in client JS, and
  gives you a single place to add caching/rate limiting/logging on the frontend side.
- Health-check endpoint on the backend (`GET /health`) so uptime can be monitored and
  the frontend can show a clear "service unavailable" state instead of failing
  silently.
- API versioning from day one (`/v1/save`, `/v1/items`, ...) so future breaking
  changes don't break the extension or dashboard silently.

### 6.3 Reliability & Data Safety
- Backend write buffering (v2's FR11) must have a durability story: if the Space
  restarts before a batch is committed to the Hub, buffered-but-uncommitted items
  would be lost — mitigate by committing frequently enough, or writing to the Space's
  persistent disk immediately and treating the Hub push as a secondary backup/sync
  step, not the only copy.
- Automated periodic backup: e.g., a scheduled job that verifies each day's JSONL
  file is present and non-corrupt on the Hub.
- Extension's local retry queue (FR6) must survive browser restarts (use
  `chrome.storage.local`, not in-memory state).

### 6.4 Observability
- Structured logging on the backend (request id, timestamp, action, status) —
  Hugging Face Spaces logs are viewable but ephemeral, so consider forwarding to a
  simple log sink if you want history beyond the Space's own log retention.
- Error tracking on the frontend (e.g., Sentry's free tier) to catch client-side
  failures in production instead of relying on the user to notice and report them.
- Basic uptime monitoring on both the Vercel frontend and the Hugging Face backend
  (e.g., a free uptime-check service hitting `/health` periodically).

### 6.5 CI/CD & Environments
- **Extension:** versioned builds, a build pipeline (GitHub Actions) that lints,
  type-checks, and packages the `.zip` for the Chrome Web Store (or for manual
  "load unpacked" during development).
- **Backend:** Hugging Face Spaces auto-deploys on push to its linked repo — treat the
  `main` branch as production; use a separate Space (or branch) for staging before
  promoting changes.
- **Frontend:** Vercel auto-deploys preview URLs per pull request and promotes to
  production on merge to `main` — use this built-in flow rather than manual deploys.
- Separate environment variables/secrets per environment (dev/staging/production) for
  both Vercel and the Hugging Face Space — never share a production auth token with a
  dev environment.
- Basic automated tests: backend endpoint tests (pytest), frontend component/integration
  tests (e.g., Playwright for the day-view and search flows) run in CI before deploy.

## 7. Data Model (unchanged from v2)

```
CapturedItem {
  id: string
  captureType: "selection" | "full_page"
  url: string
  domain: string
  title: string
  content: string
  savedAt: string        // ISO 8601
  dateKey: string         // "YYYY-MM-DD"
  deleted?: boolean
}
```

Storage layout on the Hugging Face Dataset repo (unchanged):
```
recall-dataset/
  data/
    2026-09-01.jsonl
    2026-09-02.jsonl
```

## 8. Architecture Overview

```
[Chrome Extension]
  - manual capture only (selection / full page)
  - background/service-worker: queues + sends to Frontend's API proxy
        |
        v HTTPS + token
[Frontend: Next.js on Vercel]
  - Server-side API routes proxy to backend (token stays server-side)
  - Dashboard UI: day view, heatmap, search, delete
  - Auth gate (single-user password/passkey)
        |
        v HTTPS + token
[Backend: FastAPI on Hugging Face Space]
  - /v1/save, /v1/items, /v1/search, /v1/item/{id}, /health
  - rate limiting, input validation, structured logging
  - buffers writes, batches commits to:
        v
[Storage: Hugging Face Dataset repo]
  - data/YYYY-MM-DD.jsonl, append-only + tombstone deletes
```

## 9. Suggested Tech Stack

- **Extension:** Manifest V3, TypeScript, `chrome.contextMenus`, `chrome.storage`,
  Mozilla `readability` for full-page extraction.
- **Backend:** Python, FastAPI, `huggingface_hub`, a lightweight rate limiter (e.g.
  `slowapi`), deployed as a Hugging Face Space (Docker SDK for full control over the
  server).
- **Storage:** Hugging Face Hub Dataset repo, JSONL partitioned by date.
- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, deployed on Vercel;
  NextAuth (or a minimal custom password gate) for single-user auth; Sentry for error
  tracking.
- **CI/CD:** GitHub Actions for extension packaging + backend tests; Vercel's native
  git integration for frontend deploys; Hugging Face Spaces' native git-based
  auto-deploy for the backend.

## 10. Suggested Project Structure

```
recall/
  extension/
    manifest.json
    src/
      background/service-worker.ts
      content-scripts/
        selection-capture.ts
        full-page-extract.ts
      popup/
      options/
      shared/api-client.ts
      shared/queue.ts
  backend/                          # Hugging Face Space
    app/
      main.py                       # FastAPI app, /v1 routes
      hub_writer.py                 # buffered commit logic
      hub_reader.py
      auth.py
      rate_limit.py
    tests/
    Dockerfile
    README.md                       # Space config (secrets, SDK type)
  frontend/                          # Vercel
    app/
      api/                          # server-side proxy routes to backend
      dashboard/                    # day view, search, heatmap
      login/
    lib/
      backend-client.ts
    tests/
    next.config.js
    .env.example
  .github/workflows/
    extension-build.yml
    backend-test.yml
```

## 11. MVP vs Future Phases

**Phase 1 (MVP, production-ready baseline)**
- Save Selection + Save Full Page from the extension.
- FastAPI backend on Hugging Face Space, hardened per §6.1–6.2, writing to a Hugging
  Face Dataset repo.
- Next.js dashboard on Vercel: day view, search, delete, single-user auth gate.
- CI/CD for all three components; basic monitoring/error tracking in place.

**Phase 2**
- Activity heatmap, tags/topics auto-extracted from saved content.
- Data export (JSON/CSV) from the dashboard.

**Phase 3**
- Optional semantic search (embeddings generated server-side, still within your own
  infrastructure).

## 12. Success Criteria

- Every "Save Selection"/"Save Full Page" click reliably results in the item
  appearing on the dashboard, with no silent data loss, even across network hiccups
  or Space restarts.
- Dashboard is reachable from any device via its Vercel URL, loads a given day
  quickly, and is not accessible to anyone without the login credential.
- A pushed change to any of the three components deploys through CI/CD without manual
  steps, and a broken deploy is caught by tests/monitoring before or immediately after
  it reaches production.

## 13. Assumptions Made (please confirm/adjust before building)

1. **Single-user auth** (a password/passkey gate) is enough for the dashboard — this
   is assumed to remain a personal tool, not multi-tenant. Say so if you want real
   account creation/OAuth.
2. **Next.js API routes proxy to the backend** rather than the browser calling the
   Hugging Face Space directly — recommended for security (token stays server-side)
   and assumed unless you'd prefer the simpler direct-call approach (with the token
   then necessarily exposed client-side or via a public read-only scope).
3. **Backend deployed via Hugging Face Spaces' Docker SDK** for full control (custom
   rate limiting, structured logging) rather than a more restricted Space SDK.
4. **Free/low-cost monitoring tooling** (Sentry free tier, a free uptime checker) is
   acceptable rather than paid observability stacks, given this is a personal-scale
   project.
5. Custom domain for the Vercel frontend is optional/nice-to-have, not required for
   v1 — the default `*.vercel.app` URL is fine to start.

If any of these don't match what you want, edit this doc before handing it to Claude
Code — Sections 6 and 8–10 are written to be consistent with these choices.
