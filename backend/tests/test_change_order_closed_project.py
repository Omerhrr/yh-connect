from tests.conftest import auth_headers
from tests.test_disputes import _post_project


def _hire_only(client, client_user, professional_user, amount=200000):
    project = _post_project(client, client_user)
    resp = client.post(
        f"/api/v1/projects/{project['id']}/bids",
        json={"amount": amount, "cover_letter": "I can do this", "estimated_days": 14},
        headers=auth_headers(professional_user["access_token"]),
    )
    bid = resp.json()
    resp = client.patch(f"/api/v1/bids/{bid['id']}", json={"status": "accepted"}, headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 200, resp.text
    return project


def test_cannot_propose_change_order_on_completed_project(client, client_user, professional_user):
    project = _hire_only(client, client_user, professional_user)

    resp = client.post(f"/api/v1/projects/{project['id']}/complete", headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 200, resp.text
    resp = client.post(f"/api/v1/projects/{project['id']}/confirm", headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 200, resp.text

    resp = client.get(f"/api/v1/projects/{project['id']}", headers=auth_headers(client_user["access_token"]))
    assert resp.json()["status"] == "completed"

    resp = client.post(
        f"/api/v1/projects/{project['id']}/change-orders",
        json={"description": "Add more work", "amount_delta": 10000},
        headers=auth_headers(professional_user["access_token"]),
    )
    assert resp.status_code == 400, resp.text
    assert "closed" in resp.json()["detail"].lower()


def test_cannot_propose_change_order_on_cancelled_project(client, client_user, professional_user, admin_user):
    project = _hire_only(client, client_user, professional_user)

    resp = client.patch(f"/api/v1/admin/projects/{project['id']}/cancel", headers=auth_headers(admin_user["access_token"]))
    assert resp.status_code == 200, resp.text

    resp = client.post(
        f"/api/v1/projects/{project['id']}/change-orders",
        json={"description": "Add more work", "amount_delta": 10000},
        headers=auth_headers(professional_user["access_token"]),
    )
    assert resp.status_code == 400, resp.text
