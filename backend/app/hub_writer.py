import asyncio
import json
import logging
import os
from pathlib import Path
from threading import Lock
from typing import Optional

from huggingface_hub import CommitOperationAdd, HfApi
from huggingface_hub.utils import HfHubHTTPError

from .config import Settings
from .models import CapturedItem

logger = logging.getLogger("recall.hub_writer")


class HubWriter:
    """Durable, buffered writer.

    Every save/delete is appended to a local JSONL shard (fsynced) before the
    request returns, so nothing is lost even if the Hub push never happens.
    Shards are pushed to the HF Dataset repo on a timer/threshold so the Hub
    push is a secondary sync step, not the only copy — matching §6.3 of the
    spec. On a fresh process start, any shard on disk that hasn't been
    confirmed flushed is re-marked dirty so a crash mid-cycle still
    reconciles.
    """

    def __init__(self, settings: Settings):
        self.settings = settings
        self.data_dir = Path(settings.data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()
        self._dirty_dates: set[str] = set()
        self._id_index: dict[str, str] = {}
        self._api: Optional[HfApi] = HfApi(token=settings.hf_token) if settings.hf_token else None
        self._flush_task: Optional[asyncio.Task] = None
        self._load_index()

    def _date_file(self, date_key: str) -> Path:
        return self.data_dir / f"{date_key}.jsonl"

    def _index_file(self) -> Path:
        return self.data_dir / "_index.jsonl"

    def _load_index(self) -> None:
        idx_file = self._index_file()
        if idx_file.exists():
            for line in idx_file.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line:
                    continue
                try:
                    rec = json.loads(line)
                    self._id_index[rec["id"]] = rec["dateKey"]
                except (json.JSONDecodeError, KeyError):
                    continue
        else:
            for path in self.data_dir.glob("*.jsonl"):
                if path.name == "_index.jsonl":
                    continue
                self._index_from_shard(path)

        for path in self.data_dir.glob("*.jsonl"):
            if path.name != "_index.jsonl":
                self._dirty_dates.add(path.stem)

    def _index_from_shard(self, path: Path) -> None:
        date_key = path.stem
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
                self._id_index[rec["id"]] = date_key
            except (json.JSONDecodeError, KeyError):
                continue

    @staticmethod
    def _append_local(path: Path, record: dict) -> None:
        with path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
            f.flush()
            os.fsync(f.fileno())

    def save(self, item: CapturedItem) -> None:
        record = item.model_dump()
        with self._lock:
            self._append_local(self._date_file(item.dateKey), record)
            self._append_local(self._index_file(), {"id": item.id, "dateKey": item.dateKey})
            self._id_index[item.id] = item.dateKey
            self._dirty_dates.add(item.dateKey)

    def delete(self, item_id: str) -> bool:
        date_key = self._id_index.get(item_id)
        if date_key is None:
            for path in self.data_dir.glob("*.jsonl"):
                if path.name == "_index.jsonl":
                    continue
                for line in path.read_text(encoding="utf-8").splitlines():
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        if json.loads(line).get("id") == item_id:
                            date_key = path.stem
                            break
                    except json.JSONDecodeError:
                        continue
                if date_key is not None:
                    break
        if date_key is None:
            return False

        tombstone = {"id": item_id, "dateKey": date_key, "deleted": True}
        with self._lock:
            self._append_local(self._date_file(date_key), tombstone)
            self._dirty_dates.add(date_key)
        return True

    def should_flush_now(self) -> bool:
        with self._lock:
            return len(self._dirty_dates) >= self.settings.flush_batch_size

    async def start(self) -> None:
        if self._dirty_dates:
            await self.flush()
        self._flush_task = asyncio.create_task(self._flush_loop())

    async def stop(self) -> None:
        if self._flush_task is not None:
            self._flush_task.cancel()
        await self.flush()

    async def _flush_loop(self) -> None:
        while True:
            await asyncio.sleep(self.settings.flush_interval_seconds)
            try:
                await self.flush()
            except Exception:
                logger.exception("periodic hub flush failed")

    async def flush(self) -> None:
        with self._lock:
            dirty = list(self._dirty_dates)

        if not dirty or self._api is None or not self.settings.hf_dataset_repo:
            return

        ops = [
            CommitOperationAdd(path_in_repo=f"data/{date_key}.jsonl", path_or_fileobj=str(self._date_file(date_key)))
            for date_key in dirty
            if self._date_file(date_key).exists()
        ]
        if not ops:
            return

        loop = asyncio.get_running_loop()
        try:
            await loop.run_in_executor(
                None,
                lambda: self._api.create_commit(
                    repo_id=self.settings.hf_dataset_repo,
                    repo_type="dataset",
                    operations=ops,
                    commit_message=f"sync {len(ops)} date shard(s)",
                ),
            )
        except HfHubHTTPError:
            logger.exception("hub commit failed, will retry on next flush cycle")
            return

        with self._lock:
            self._dirty_dates.difference_update(dirty)
        logger.info("flushed %d date shard(s) to hub", len(ops))
