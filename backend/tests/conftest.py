import importlib
import sys

import pytest
from fastapi.testclient import TestClient

TEST_EMAIL = "tester@example.com"
TEST_PASSWORD = "correct-horse-battery"


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_path.as_posix()}")
    monkeypatch.setenv("JWT_SECRET", "test-jwt-secret")
    monkeypatch.setenv("ALLOWED_ORIGINS", "http://localhost:3000")

    for mod_name in list(sys.modules):
        if mod_name == "app" or mod_name.startswith("app."):
            del sys.modules[mod_name]

    from app import main as main_module

    importlib.reload(main_module)

    with TestClient(main_module.app) as test_client:
        yield test_client


@pytest.fixture()
def auth_headers(client):
    r = client.post("/auth/signup", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
    assert r.status_code == 201, r.text
    token = r.json()["token"]
    return {"Authorization": f"Bearer {token}"}
