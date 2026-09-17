def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_signup_and_login(client):
    r = client.post("/auth/signup", json={"email": "a@example.com", "password": "correct-horse-battery"})
    assert r.status_code == 201
    assert r.json()["token"]

    r2 = client.post("/auth/login", json={"email": "a@example.com", "password": "correct-horse-battery"})
    assert r2.status_code == 200
    assert r2.json()["token"]


def test_signup_rejects_duplicate_email(client):
    client.post("/auth/signup", json={"email": "dup@example.com", "password": "correct-horse-battery"})
    r = client.post("/auth/signup", json={"email": "dup@example.com", "password": "another-password"})
    assert r.status_code == 409


def test_signup_rejects_short_password(client):
    r = client.post("/auth/signup", json={"email": "short@example.com", "password": "short"})
    assert r.status_code == 422


def test_login_rejects_wrong_password(client):
    client.post("/auth/signup", json={"email": "b@example.com", "password": "correct-horse-battery"})
    r = client.post("/auth/login", json={"email": "b@example.com", "password": "wrong-password"})
    assert r.status_code == 401


def test_login_rejects_unknown_email(client):
    r = client.post("/auth/login", json={"email": "nobody@example.com", "password": "correct-horse-battery"})
    assert r.status_code == 401


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


def test_save_and_list(client, auth_headers):
    r = client.post(
        "/v1/save",
        json={
            "captureType": "selection",
            "url": "https://example.com/a",
            "title": "Example",
            "content": "hello world",
        },
        headers=auth_headers,
    )
    assert r.status_code == 201
    item = r.json()["item"]
    assert item["domain"] == "example.com"
    date_key = item["dateKey"]

    r2 = client.get(f"/v1/items?date={date_key}", headers=auth_headers)
    assert r2.status_code == 200
    items = r2.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == item["id"]


def test_save_rejects_bad_url(client, auth_headers):
    r = client.post(
        "/v1/save",
        json={"captureType": "selection", "url": "not-a-url", "content": "x"},
        headers=auth_headers,
    )
    assert r.status_code == 422


def test_save_rejects_empty_content(client, auth_headers):
    r = client.post(
        "/v1/save",
        json={"captureType": "full_page", "url": "https://example.com", "content": "   "},
        headers=auth_headers,
    )
    assert r.status_code == 422


def test_search_finds_saved_item(client, auth_headers):
    client.post(
        "/v1/save",
        json={
            "captureType": "selection",
            "url": "https://a.com",
            "title": "Alpha",
            "content": "unique-keyword-here",
        },
        headers=auth_headers,
    )
    r = client.get("/v1/search?q=unique-keyword", headers=auth_headers)
    assert r.status_code == 200
    assert len(r.json()["items"]) == 1


def test_delete_removes_item_from_day_view(client, auth_headers):
    save = client.post(
        "/v1/save",
        json={"captureType": "selection", "url": "https://a.com", "content": "to-delete"},
        headers=auth_headers,
    )
    item_id = save.json()["item"]["id"]
    date_key = save.json()["item"]["dateKey"]

    r = client.delete(f"/v1/item/{item_id}", headers=auth_headers)
    assert r.status_code == 200
    assert r.json() == {"id": item_id, "deleted": True}

    r2 = client.get(f"/v1/items?date={date_key}", headers=auth_headers)
    assert all(i["id"] != item_id for i in r2.json()["items"])


def test_delete_nonexistent_returns_404(client, auth_headers):
    r = client.delete("/v1/item/does-not-exist", headers=auth_headers)
    assert r.status_code == 404


def test_invalid_date_format_rejected(client, auth_headers):
    r = client.get("/v1/items?date=2026-13-40", headers=auth_headers)
    assert r.status_code == 400


def test_activity_counts(client, auth_headers):
    save = client.post(
        "/v1/save",
        json={"captureType": "full_page", "url": "https://a.com", "content": "for activity"},
        headers=auth_headers,
    )
    date_key = save.json()["item"]["dateKey"]
    r = client.get("/v1/activity", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["counts"].get(date_key) == 1


def test_items_are_isolated_between_users(client):
    r1 = client.post("/auth/signup", json={"email": "owner1@example.com", "password": "correct-horse-battery"})
    r2 = client.post("/auth/signup", json={"email": "owner2@example.com", "password": "correct-horse-battery"})
    headers1 = {"Authorization": f"Bearer {r1.json()['token']}"}
    headers2 = {"Authorization": f"Bearer {r2.json()['token']}"}

    save = client.post(
        "/v1/save",
        json={"captureType": "selection", "url": "https://a.com", "content": "owner1-secret"},
        headers=headers1,
    )
    date_key = save.json()["item"]["dateKey"]

    r = client.get(f"/v1/items?date={date_key}", headers=headers2)
    assert r.json()["items"] == []

    r = client.get("/v1/search?q=owner1-secret", headers=headers2)
    assert r.json()["items"] == []

    delete_resp = client.delete(f"/v1/item/{save.json()['item']['id']}", headers=headers2)
    assert delete_resp.status_code == 404
