from tests.conftest import auth_headers


def _post_project(client, client_user):
    resp = client.post(
        "/api/v1/projects",
        json={
            "title": "Build a bungalow",
            "description": "3 bedroom bungalow in Lekki",
            "category_id": "civil-structural-engineering",
            "budget_min": 500000,
            "budget_max": 1000000,
            "location": "Lekki, Lagos",
        },
        headers=auth_headers(client_user["access_token"]),
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_client_can_post_project(client, client_user):
    project = _post_project(client, client_user)
    assert project["status"] == "open"
    assert project["title"] == "Build a bungalow"


def test_professional_cannot_post_project(client, professional_user):
    resp = client.post(
        "/api/v1/projects",
        json={
            "title": "Should fail",
            "description": "x",
            "category_id": "civil-structural-engineering",
            "budget_min": 1000,
            "budget_max": 2000,
        },
        headers=auth_headers(professional_user["access_token"]),
    )
    assert resp.status_code == 403


def test_bid_flow_and_notification(client, client_user, professional_user):
    project = _post_project(client, client_user)

    resp = client.post(
        f"/api/v1/projects/{project['id']}/bids",
        json={"amount": 750000, "cover_letter": "I can do this", "estimated_days": 30},
        headers=auth_headers(professional_user["access_token"]),
    )
    assert resp.status_code == 201, resp.text
    bid = resp.json()

    # Client should have a bid-received notification.
    resp = client.get("/api/v1/notifications", headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 200
    assert any(n["type"] == "bid_received" for n in resp.json())

    # Professional can't bid twice on the same project.
    resp = client.post(
        f"/api/v1/projects/{project['id']}/bids",
        json={"amount": 800000, "cover_letter": "again", "estimated_days": 20},
        headers=auth_headers(professional_user["access_token"]),
    )
    assert resp.status_code == 409

    # Client accepts the bid.
    resp = client.patch(
        f"/api/v1/bids/{bid['id']}",
        json={"status": "accepted"},
        headers=auth_headers(client_user["access_token"]),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "accepted"

    resp = client.get("/api/v1/notifications", headers=auth_headers(professional_user["access_token"]))
    assert any(n["type"] == "bid_accepted" for n in resp.json())


def test_webhook_rejects_bad_signature_when_configured(client, monkeypatch):
    """In simulated mode (no live Monnify keys) the webhook accepts payloads
    without a signature, this is expected local-dev behavior. Once keys are
    configured, verify_webhook_signature() must actually gate the request,
    that's what this test locks in."""
    from app.services.monnify import monnify_client

    monkeypatch.setattr(type(monnify_client), "is_configured", property(lambda self: True))
    monkeypatch.setattr(monnify_client, "secret_key", "top-secret")

    resp = client.post(
        "/api/v1/webhooks/monnify",
        json={"eventData": {"transactionReference": "does-not-exist", "paymentStatus": "PAID"}},
    )
    assert resp.status_code == 401
