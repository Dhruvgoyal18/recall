import json
import logging
from pathlib import Path
from typing import Optional

from huggingface_hub import hf_hub_download, list_repo_files
from huggingface_hub.utils import HfHubHTTPError

from .config import Settings
from .models import CapturedItem

logger = logging.getLogger("recall.hub_reader")


class HubReader:
    """Reads day-shards local-first, falling back to the Hub for shards this
    process hasn't written itself (e.g. a fresh Space instance)."""

    def __init__(self, settings: Settings, data_dir: Path):
        self.settings = settings
        self.data_dir = data_dir
        self._hf_token = settings.hf_token or None

    def _parse_shard(self, path: Path) -> dict[str, CapturedItem]:
        latest: dict[str, dict] = {}
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            latest[rec["id"]] = rec

        items: dict[str, CapturedItem] = {}
        for rec_id, rec in latest.items():
            if rec.get("deleted"):
                continue
            try:
                items[rec_id] = CapturedItem(**rec)
            except Exception:
                logger.warning("skipping malformed record %s", rec_id)
        return items

    def _ensure_local_shard(self, date_key: str) -> Optional[Path]:
        path = self.data_dir / f"{date_key}.jsonl"
        if path.exists():
            return path
        if not self.settings.hf_dataset_repo:
            return None
        try:
            downloaded = hf_hub_download(
                repo_id=self.settings.hf_dataset_repo,
                repo_type="dataset",
                filename=f"data/{date_key}.jsonl",
                local_dir=str(self.data_dir.parent / "_hf_cache"),
                token=self._hf_token,
            )
            return Path(downloaded)
        except (HfHubHTTPError, Exception):
            return None

    def get_items_for_date(self, date_key: str) -> list[CapturedItem]:
        path = self._ensure_local_shard(date_key)
        if path is None:
            return []
        items = self._parse_shard(path)
        return sorted(items.values(), key=lambda i: i.savedAt, reverse=True)

    def _all_date_keys(self) -> list[str]:
        keys = {p.stem for p in self.data_dir.glob("*.jsonl") if p.stem != "_index"}
        if self.settings.hf_dataset_repo:
            try:
                for f in list_repo_files(
                    repo_id=self.settings.hf_dataset_repo, repo_type="dataset", token=self._hf_token
                ):
                    if f.startswith("data/") and f.endswith(".jsonl"):
                        keys.add(Path(f).stem)
            except Exception:
                logger.warning("could not list hub repo files", exc_info=True)
        return sorted(keys, reverse=True)

    def search(self, query: str, limit: int = 200) -> list[CapturedItem]:
        query_lower = query.lower()
        results: list[CapturedItem] = []
        for date_key in self._all_date_keys():
            for item in self.get_items_for_date(date_key):
                haystack = f"{item.title}\n{item.content}\n{item.url}".lower()
                if query_lower in haystack:
                    results.append(item)
        results.sort(key=lambda i: i.savedAt, reverse=True)
        return results[:limit]

    def activity_counts(self, days: int = 30) -> dict[str, int]:
        counts: dict[str, int] = {}
        for date_key in self._all_date_keys()[:days]:
            counts[date_key] = len(self.get_items_for_date(date_key))
        return counts
