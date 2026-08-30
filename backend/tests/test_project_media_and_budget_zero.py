from tests.conftest import auth_headers

def _post_project(client, client_user, **overrides):
    payload = {
        "title": "Build a bungalow",
        "description": "3 bedroom bungalow in Lekki",
        "category_id": "civil-structural-engineering",
        "budget_min": 500000,
        "budget_max": 1000000,
        "location": "Lekki, Lagos",
    }
    payload.update(overrides)
    resp = client.post("/api/v1/projects", json=payload, headers=auth_headers(client_user["access_token"]))
    return resp

def test_budget_zero_means_not_set(client, client_user):
    resp = _post_project(client, client_user, budget_min=0, budget_max=0)
    assert resp.status_code == 201, resp.text
    project = resp.json()
    assert project["budget_min"] == 0
    assert project["budget_max"] == 0

def test_negative_budget_rejected(client, client_user):
    resp = _post_project(client, client_user, budget_min=-100, budget_max=0)
    assert resp.status_code == 400

def test_budget_min_greater_than_max_rejected(client, client_user):
    resp = _post_project(client, client_user, budget_min=1000, budget_max=500)
    assert resp.status_code == 400

def test_images_included_when_enabled_by_default(client, client_user):
    resp = _post_project(client, client_user, image_urls=["https://example.com/a.png"])
    assert resp.status_code == 201, resp.text
    assert resp.json()["image_urls"] == ["https://example.com/a.png"]

def test_video_silently_dropped_when_disabled_by_default(client, client_user):
    resp = _post_project(client, client_user, video_url="https://example.com/video.mp4")
    assert resp.status_code == 201, resp.text
    assert resp.json()["video_url"] is None

def test_admin_can_enable_video_and_it_then_persists(client, client_user, admin_user):
    resp = client.get("/api/v1/admin/project-media-settings", headers=auth_headers(admin_user["access_token"]))
    assert resp.status_code == 200
    assert resp.json()["video_enabled"] is False

    resp = client.put(
        "/api/v1/admin/project-media-settings",
        json={"video_enabled": True},
        headers=auth_headers(admin_user["access_token"]),
    )
    assert resp.status_code == 200
    assert resp.json()["video_enabled"] is True

    resp = _post_project(client, client_user, video_url="https://example.com/video.mp4")
    assert resp.status_code == 201, resp.text
    assert resp.json()["video_url"] == "https://example.com/video.mp4"

    resp = client.put(
        "/api/v1/admin/project-media-settings",
        json={"video_enabled": False},
        headers=auth_headers(admin_user["access_token"]),
    )
    assert resp.status_code == 200

def test_admin_can_disable_images(client, client_user, admin_user):
    resp = client.put(
        "/api/v1/admin/project-media-settings",
        json={"images_enabled": False},
        headers=auth_headers(admin_user["access_token"]),
    )
    assert resp.status_code == 200
    assert resp.json()["images_enabled"] is False

    resp = _post_project(client, client_user, image_urls=["https://example.com/a.png"])
    assert resp.status_code == 201, resp.text
    assert resp.json()["image_urls"] == []

    resp = client.put(
        "/api/v1/admin/project-media-settings",
        json={"images_enabled": True},
        headers=auth_headers(admin_user["access_token"]),
    )
    assert resp.status_code == 200

def test_public_media_settings_endpoint_no_auth(client):
    resp = client.get("/api/v1/projects/media-settings")
    assert resp.status_code == 200
    body = resp.json()
    assert body["images_enabled"] is True
    assert body["video_enabled"] is False

def test_image_count_capped_at_eight(client, client_user):
    urls = [f"https://example.com/{i}.png" for i in range(12)]
    resp = _post_project(client, client_user, image_urls=urls)
    assert resp.status_code == 201, resp.text
    assert len(resp.json()["image_urls"]) == 8
