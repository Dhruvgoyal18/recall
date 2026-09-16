# Recall Backend

FastAPI service that receives explicit "Save Selection" / "Save Full Page"
captures from the Recall Chrome extension (via the Next.js proxy), durably
writes them to a local disk shard, and syncs them to a Hugging Face Hub
Dataset repo as backup, partitioned by day (`data/YYYY-MM-DD.jsonl`).

Deployed on [Railway](https://railway.app) as a Docker web service — see
`railway.json` in this directory for the build/deploy config.

## Endpoints

| Method | Path              | Auth | Notes                                  |
|--------|-------------------|------|------------------------------------------|
| GET    | `/health`         | no   | Liveness/uptime check                   |
| POST   | `/v1/save`        | yes  | `{captureType, url, title, content}`    |
| GET    | `/v1/items?date=` | yes  | `YYYY-MM-DD` day view                   |
| GET    | `/v1/search?q=`   | yes  | Keyword search across all days          |
| GET    | `/v1/activity`    | yes  | Per-day counts for the 30-day heatmap   |
| DELETE | `/v1/item/{id}`   | yes  | Tombstone delete                        |

All authenticated endpoints require `Authorization: Bearer <AUTH_TOKEN>`.

## Required environment variables (Railway)

Set these in the Railway dashboard (service → Variables tab):

- `AUTH_TOKEN` — shared secret the frontend proxy and extension present.
- `HF_TOKEN` — a Hugging Face token with **write** access to the dataset repo,
  used to push/pull `HF_DATASET_REPO` as a backup sync target.
- `HF_DATASET_REPO` — e.g. `Dhruvgoyal18/recall-dataset`.
- `ALLOWED_ORIGINS` — comma-separated list, e.g.
  `https://recall-dashboard-five.vercel.app,http://localhost:3000`.

Optional: `FLUSH_INTERVAL_SECONDS` (default `8`), `FLUSH_BATCH_SIZE` (default `5`).

## Durability model

Every save/delete is fsynced to a local JSONL shard under `DATA_DIR`
*before* the request returns — that's the durable write. A background task
pushes dirty shards to the Hub dataset repo in one batched commit every
`FLUSH_INTERVAL_SECONDS` (or immediately once `FLUSH_BATCH_SIZE` shards are
dirty), so the Hub push is a secondary sync step, not the only copy. On
restart, any shard left on local disk is re-marked dirty and flushed once at
startup, so a crash mid-cycle still reconciles.

A Railway [Volume](https://docs.railway.com/reference/volumes) mounted at
`/data` makes local shards survive deploys and restarts, so unlike an
ephemeral filesystem, the Hub push remains a secondary backup/sync copy, not
the only line of defense. Attach the volume once from the Railway dashboard
(service → Settings → Volumes → mount path `/data`) — this isn't expressible
in `railway.json` today, so it's a one-time manual step per environment.

## Deploy

Railway dashboard: New Project → Deploy from GitHub repo → select this repo
→ set the service's **Root Directory** to `backend` (this is a monorepo) so
Railway picks up `railway.json` and builds `Dockerfile` from there. Add the
env vars above, attach the `/data` volume once, and Railway auto-deploys on
every push to `main` after that — no custom deploy workflow needed, matching
the frontend/Vercel and extension/GitHub Actions flows.

## Local development

```bash
cd backend
python -m venv .venv && . .venv/Scripts/activate  # or source .venv/bin/activate
pip install -r requirements.txt
AUTH_TOKEN=dev-token uvicorn app.main:app --reload --port 8000
```

## Tests

```bash
pip install -r requirements.txt pytest
pytest
```
