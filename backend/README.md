---
title: Recall Backend
emoji: 🗂️
colorFrom: indigo
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# Recall Backend

FastAPI service that receives explicit "Save Selection" / "Save Full Page"
captures from the Recall Chrome extension (via the Next.js proxy) and
persists them to a Hugging Face Hub Dataset repo, partitioned by day
(`data/YYYY-MM-DD.jsonl`).

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

## Required Space secrets

- `AUTH_TOKEN` — shared secret the frontend proxy and extension present.
- `HF_TOKEN` — a Hugging Face token with **write** access to the dataset repo,
  used by this Space to push/pull `HF_DATASET_REPO`.
- `HF_DATASET_REPO` — e.g. `Dhruvgoyal18/recall-dataset`.
- `ALLOWED_ORIGINS` — comma-separated list, e.g.
  `https://recall-dashboard.vercel.app,http://localhost:3000`.

Optional: `FLUSH_INTERVAL_SECONDS` (default `8`), `FLUSH_BATCH_SIZE` (default `5`).

## Durability model

Every save/delete is fsynced to a local JSONL shard under `DATA_DIR`
*before* the request returns — that's the durable write. A background task
pushes dirty shards to the Hub dataset repo in one batched commit every
`FLUSH_INTERVAL_SECONDS` (or immediately once `FLUSH_BATCH_SIZE` shards are
dirty), so the Hub push is a secondary sync step, not the only copy. On
restart, any shard left on local disk is re-marked dirty and flushed once at
startup, so a crash mid-cycle still reconciles.

**Caveat:** on the free Hugging Face Spaces tier, `/data` is ephemeral and is
wiped on a rebuild/restart. That bounds data-loss exposure to whatever hasn't
been flushed yet (a few seconds, by default) rather than eliminating it. For
zero-loss durability across restarts, attach a persistent storage volume to
the Space and mount it at `DATA_DIR`.

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
