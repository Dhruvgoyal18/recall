import importlib
import sys

import pytest
from fastapi.testclient import TestClient

AUTH_HEADERS = {"Authorization": "Bearer test-token"}


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("AUTH_TOKEN", "test-token")
    monkeypatch.setenv("DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setenv("HF_TOKEN", "")
    monkeypatch.setenv("HF_DATASET_REPO", "")
    monkeypatch.setenv("ALLOWED_ORIGINS", "http://localhost:3000")
    monkeypatch.setenv("FLUSH_INTERVAL_SECONDS", "9999")
    monkeypatch.setenv("FLUSH_BATCH_SIZE", "9999")

    for mod_name in list(sys.modules):
        if mod_name == "app" or mod_name.startswith("app."):
            del sys.modules[mod_name]

    from app import main as main_module

    importlib.reload(main_module)

    with TestClient(main_module.app) as test_client:
        yield test_client
