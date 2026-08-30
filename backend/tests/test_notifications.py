from tests.conftest import auth_headers
from tests.test_disputes import _post_project

def test_notification_delete_and_clear(client, client_user, professional_user):
    project = _post_project(client, client_user)
    resp = client.post(
        f"/api/v1/projects/{project['id']}/bids",
        json={"amount": 200000, "cover_letter": "I can do this", "estimated_days": 14},
        headers=auth_headers(professional_user["access_token"]),
    )
    assert resp.status_code == 201, resp.text

    resp = client.get("/api/v1/notifications", headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 200, resp.text
    notifs = resp.json()
    assert len(notifs) >= 1
    notif_id = notifs[0]["id"]

    resp = client.delete(f"/api/v1/notifications/{notif_id}", headers=auth_headers(professional_user["access_token"]))
    assert resp.status_code == 404

    resp = client.delete(f"/api/v1/notifications/{notif_id}", headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 200, resp.text

    resp = client.get("/api/v1/notifications", headers=auth_headers(client_user["access_token"]))
    assert notif_id not in [n["id"] for n in resp.json()]

def test_notification_mark_all_and_clear_all(client, client_user, professional_user):
    project = _post_project(client, client_user)
    for _ in range(2):
        p2 = _post_project(client, client_user)
        client.post(
            f"/api/v1/projects/{p2['id']}/bids",
            json={"amount": 150000, "cover_letter": "Hi", "estimated_days": 5},
            headers=auth_headers(professional_user["access_token"]),
        )

    resp = client.get("/api/v1/notifications/unread-count", headers=auth_headers(client_user["access_token"]))
    assert resp.json()["count"] >= 1

    resp = client.post("/api/v1/notifications/read-all", headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 200, resp.text

    resp = client.get("/api/v1/notifications/unread-count", headers=auth_headers(client_user["access_token"]))
    assert resp.json()["count"] == 0

    resp = client.delete("/api/v1/notifications", headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 200, resp.text

    resp = client.get("/api/v1/notifications", headers=auth_headers(client_user["access_token"]))
    assert resp.json() == []
