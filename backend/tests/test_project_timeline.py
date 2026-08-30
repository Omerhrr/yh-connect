from tests.conftest import auth_headers


def test_create_project_with_timeline(client, client_user):
    resp = client.post(
        "/api/v1/projects",
        json={
            "title": "Renovate kitchen",
            "description": "Full kitchen renovation",
            "category_id": "civil-structural-engineering",
            "budget_min": 100000,
            "budget_max": 300000,
            "location": "Ikeja, Lagos",
            "timeline": "2-3 weeks",
        },
        headers=auth_headers(client_user["access_token"]),
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["timeline"] == "2-3 weeks"


def test_create_project_without_timeline_defaults_none(client, client_user):
    resp = client.post(
        "/api/v1/projects",
        json={
            "title": "Paint fence",
            "description": "Repaint the perimeter fence",
            "category_id": "civil-structural-engineering",
            "budget_min": 50000,
            "budget_max": 80000,
        },
        headers=auth_headers(client_user["access_token"]),
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["timeline"] is None


def test_update_project_timeline(client, client_user):
    resp = client.post(
        "/api/v1/projects",
        json={
            "title": "Build a fence",
            "description": "Perimeter fence with gate",
            "category_id": "civil-structural-engineering",
            "budget_min": 100000,
            "budget_max": 300000,
        },
        headers=auth_headers(client_user["access_token"]),
    )
    project = resp.json()

    resp = client.patch(
        f"/api/v1/projects/{project['id']}",
        json={"timeline": "By end of March"},
        headers=auth_headers(client_user["access_token"]),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["timeline"] == "By end of March"
