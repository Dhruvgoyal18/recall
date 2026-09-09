from .conftest import AUTH_HEADERS


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_save_requires_auth(client):
    r = client.post(
        "/v1/save",
        json={"captureType": "selection", "url": "https://example.com", "content": "hello"},
    )
    assert r.status_code == 401


def test_save_rejects_bad_token(client):
    r = client.post(
        "/v1/save",
        json={"captureType": "selection", "url": "https://example.com", "content": "hello"},
        headers={"Authorization": "Bearer wrong-token"},
    )
    assert r.status_code == 401


def test_save_and_list(client):
    r = client.post(
        "/v1/save",
        json={
            "captureType": "selection",
            "url": "https://example.com/a",
            "title": "Example",
            "content": "hello world",
        },
        headers=AUTH_HEADERS,
    )
    assert r.status_code == 201
    item = r.json()["item"]
    assert item["domain"] == "example.com"
    date_key = item["dateKey"]

    r2 = client.get(f"/v1/items?date={date_key}", headers=AUTH_HEADERS)
    assert r2.status_code == 200
    items = r2.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == item["id"]


def test_save_rejects_bad_url(client):
    r = client.post(
        "/v1/save",
        json={"captureType": "selection", "url": "not-a-url", "content": "x"},
        headers=AUTH_HEADERS,
    )
    assert r.status_code == 422


def test_save_rejects_empty_content(client):
    r = client.post(
        "/v1/save",
        json={"captureType": "full_page", "url": "https://example.com", "content": "   "},
        headers=AUTH_HEADERS,
    )
    assert r.status_code == 422


def test_search_finds_saved_item(client):
    client.post(
        "/v1/save",
        json={
            "captureType": "selection",
            "url": "https://a.com",
            "title": "Alpha",
            "content": "unique-keyword-here",
        },
        headers=AUTH_HEADERS,
    )
    r = client.get("/v1/search?q=unique-keyword", headers=AUTH_HEADERS)
    assert r.status_code == 200
    assert len(r.json()["items"]) == 1


def test_delete_removes_item_from_day_view(client):
    save = client.post(
        "/v1/save",
        json={"captureType": "selection", "url": "https://a.com", "content": "to-delete"},
        headers=AUTH_HEADERS,
    )
    item_id = save.json()["item"]["id"]
    date_key = save.json()["item"]["dateKey"]

    r = client.delete(f"/v1/item/{item_id}", headers=AUTH_HEADERS)
    assert r.status_code == 200
    assert r.json() == {"id": item_id, "deleted": True}

    r2 = client.get(f"/v1/items?date={date_key}", headers=AUTH_HEADERS)
    assert all(i["id"] != item_id for i in r2.json()["items"])


def test_delete_nonexistent_returns_404(client):
    r = client.delete("/v1/item/does-not-exist", headers=AUTH_HEADERS)
    assert r.status_code == 404


def test_invalid_date_format_rejected(client):
    r = client.get("/v1/items?date=2026-13-40", headers=AUTH_HEADERS)
    assert r.status_code == 400


def test_activity_counts(client):
    save = client.post(
        "/v1/save",
        json={"captureType": "full_page", "url": "https://a.com", "content": "for activity"},
        headers=AUTH_HEADERS,
    )
    date_key = save.json()["item"]["dateKey"]
    r = client.get("/v1/activity", headers=AUTH_HEADERS)
    assert r.status_code == 200
    assert r.json()["counts"].get(date_key) == 1
