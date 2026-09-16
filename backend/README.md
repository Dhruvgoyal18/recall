# Recall Backend

FastAPI service that receives explicit "Save Selection" / "Save Full Page"
captures from the Recall Chrome extension (via the Next.js proxy), durably
writes them to a local disk shard, and syncs them to a Hugging Face Hub
Dataset repo as backup, partitioned by day (`data/YYYY-MM-DD.jsonl`).

Deployed on [Render](https://render.com) as a Docker web service — see
`render.yaml` at the repo root for the Blueprint config.

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

## Required environment variables (Render)

Set these in the Render dashboard (Environment tab) — `render.yaml` declares
them with `sync: false` so Render prompts for values rather than committing
them:

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

`render.yaml` attaches a persistent Render Disk mounted at `/data`, so unlike
an ephemeral filesystem, local shards survive deploys and restarts — the Hub
push remains a secondary backup/sync copy, not the only line of defense.

## Deploy

This repo's `render.yaml` (at the repo root) is a Render Blueprint. In the
Render dashboard: New → Blueprint → connect this GitHub repo → Render reads
`render.yaml`, provisions the `recall-backend` web service with its disk, and
prompts for the `sync: false` secrets above. Render auto-deploys on every
push to `main` after that — no custom deploy workflow needed, matching the
frontend/Vercel and extension/GitHub Actions flows.

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
