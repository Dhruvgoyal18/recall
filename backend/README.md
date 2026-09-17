# Recall Backend

FastAPI service that receives explicit "Save Selection" / "Save Full Page"
captures from the Recall Chrome extension (via the Next.js proxy) and
persists them in Postgres, scoped per signed-up user.

Deployed on [Railway](https://railway.app) as a Docker web service — see
`railway.json` in this directory for the build/deploy config.

## Endpoints

| Method | Path              | Auth | Notes                                    |
|--------|-------------------|------|-------------------------------------------|
| GET    | `/health`         | no   | Liveness/uptime check                     |
| POST   | `/auth/signup`    | no   | `{email, password}` -> `{token, expiresAt}` |
| POST   | `/auth/login`     | no   | `{email, password}` -> `{token, expiresAt}` |
| POST   | `/v1/save`        | yes  | `{captureType, url, title, content}`      |
| GET    | `/v1/items?date=` | yes  | `YYYY-MM-DD` day view                     |
| GET    | `/v1/search?q=`   | yes  | Keyword search across all days            |
| GET    | `/v1/activity`    | yes  | Per-day counts for the 30-day heatmap     |
| DELETE | `/v1/item/{id}`   | yes  | Tombstone delete                          |

All authenticated endpoints require `Authorization: Bearer <token>`, where
`<token>` is the JWT returned by `/auth/signup` or `/auth/login`. Every data
endpoint is scoped to the token's owning user — there is no cross-user
visibility.

## Required environment variables (Railway)

Set these in the Railway dashboard (service → Variables tab):

- `DATABASE_URL` — Postgres connection string, e.g.
  `postgresql+asyncpg://user:pass@host:5432/railway` (Railway's managed
  Postgres plugin provides this; adjust the scheme to `postgresql+asyncpg://`
  since the app uses SQLAlchemy's async driver).
- `JWT_SECRET` — signs/verifies session tokens issued by `/auth/login` and
  `/auth/signup`. Generate a strong random value; rotating it invalidates
  all existing sessions.
- `ALLOWED_ORIGINS` — comma-separated list, e.g.
  `https://recall-dashboard-five.vercel.app,http://localhost:3000`.

Optional: `JWT_EXPIRES_DAYS` (default `30`).

## Data model

Two tables, managed by Alembic (`alembic/versions/`):
- `users` — `id`, `email` (unique), `password_hash` (bcrypt), `created_at`.
- `items` — one row per saved capture, `user_id`-scoped, indexed on
  `(user_id, date_key)` for the day view and on `user_id` for search/activity.

The app also runs `Base.metadata.create_all` on startup as a safety net for
first boot; Alembic (`alembic upgrade head`) is the authoritative way to
apply schema changes going forward.

## Deploy

Railway dashboard: New Project → Deploy from GitHub repo → select this repo
→ set the service's **Root Directory** to `backend` (this is a monorepo) so
Railway picks up `railway.json` and builds `Dockerfile` from there. Add a
Postgres plugin to the project (provides `DATABASE_URL` automatically —
just adjust the scheme to `postgresql+asyncpg://` as above), set the other
env vars above, run `alembic upgrade head` once against the new database,
and Railway auto-deploys on every push to `main` after that.

## Local development

```bash
cd backend
python -m venv .venv && . .venv/Scripts/activate  # or source .venv/bin/activate
pip install -r requirements.txt
DATABASE_URL=postgresql+asyncpg://localhost/recall JWT_SECRET=dev-secret uvicorn app.main:app --reload --port 8000
alembic upgrade head   # apply migrations against DATABASE_URL
```

## Tests

Tests run against a throwaway SQLite database (via `aiosqlite`), no Postgres
required locally:

```bash
pip install -r requirements-dev.txt
pytest
```
