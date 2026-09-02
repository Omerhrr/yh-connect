from tests.conftest import auth_headers
from tests.test_disputes import _post_project, _approve_contract_and_pay_fee

def _hire(client, client_user, professional_user, amount=200000):
    project = _post_project(client, client_user)
    resp = client.post(
        f"/api/v1/projects/{project['id']}/bids",
        json={"amount": amount, "cover_letter": "I can do this", "estimated_days": 14},
        headers=auth_headers(professional_user["access_token"]),
    )
    bid = resp.json()
    resp = client.patch(f"/api/v1/bids/{bid['id']}", json={"status": "accepted"}, headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 200, resp.text
    _approve_contract_and_pay_fee(client, project["id"], client_user, professional_user)
    return project

def _create_milestone(client, client_user, project_id, title="Foundation", amount=100000):
    resp = client.post(
        f"/api/v1/projects/{project_id}/milestones",
        json={"title": title, "amount": amount},
        headers=auth_headers(client_user["access_token"]),
    )
    assert resp.status_code == 201, resp.text
    return resp.json()

def test_professional_cannot_post_update_before_funding(client, client_user, professional_user):
    project = _hire(client, client_user, professional_user)
    milestone = _create_milestone(client, client_user, project["id"])

    resp = client.post(
        f"/api/v1/milestones/{milestone['id']}/updates",
        json={"note": "Started digging the foundation"},
        headers=auth_headers(professional_user["access_token"]),
    )
    assert resp.status_code == 400, resp.text
    assert "funded" in resp.json()["detail"].lower()

def test_professional_cannot_submit_before_funding(client, client_user, professional_user):
    project = _hire(client, client_user, professional_user)
    milestone = _create_milestone(client, client_user, project["id"])

    resp = client.post(
        f"/api/v1/milestones/{milestone['id']}/submit",
        headers=auth_headers(professional_user["access_token"]),
    )
    assert resp.status_code == 400, resp.text
    assert "funded" in resp.json()["detail"].lower()

def test_professional_can_post_update_and_submit_once_funded(client, client_user, professional_user):
    project = _hire(client, client_user, professional_user)
    milestone = _create_milestone(client, client_user, project["id"])

    client.post("/api/v1/wallet/topup", json={"amount": 500000}, headers=auth_headers(client_user["access_token"]))
    resp = client.post(f"/api/v1/milestones/{milestone['id']}/fund", json={}, headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 200, resp.text

    resp = client.post(
        f"/api/v1/milestones/{milestone['id']}/updates",
        json={"note": "Foundation dug"},
        headers=auth_headers(professional_user["access_token"]),
    )
    assert resp.status_code == 201, resp.text

    resp = client.post(
        f"/api/v1/milestones/{milestone['id']}/submit",
        headers=auth_headers(professional_user["access_token"]),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["status"] == "funded"
    assert body["submitted_at"] is not None

def test_approve_releases_funds_instantly_to_professional_wallet(client, client_user, professional_user):
    project = _hire(client, client_user, professional_user)
    milestone = _create_milestone(client, client_user, project["id"], amount=100000)

    client.post("/api/v1/wallet/topup", json={"amount": 500000}, headers=auth_headers(client_user["access_token"]))
    client.post(f"/api/v1/milestones/{milestone['id']}/fund", json={}, headers=auth_headers(client_user["access_token"]))
    client.post(f"/api/v1/milestones/{milestone['id']}/submit", headers=auth_headers(professional_user["access_token"]))

    balance_before = client.get("/api/v1/auth/me", headers=auth_headers(professional_user["access_token"])).json()["wallet_balance"]

    resp = client.post(f"/api/v1/milestones/{milestone['id']}/approve", headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "paid"

    balance_after = client.get("/api/v1/auth/me", headers=auth_headers(professional_user["access_token"])).json()["wallet_balance"]

    assert balance_after == balance_before + 95000

def test_approve_requires_funded_milestone(client, client_user, professional_user):
    project = _hire(client, client_user, professional_user)
    milestone = _create_milestone(client, client_user, project["id"])

    resp = client.post(f"/api/v1/milestones/{milestone['id']}/approve", headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 400, resp.text

def test_release_endpoint_no_longer_exists(client, client_user, professional_user):
    project = _hire(client, client_user, professional_user)
    milestone = _create_milestone(client, client_user, project["id"])
    client.post("/api/v1/wallet/topup", json={"amount": 500000}, headers=auth_headers(client_user["access_token"]))
    client.post(f"/api/v1/milestones/{milestone['id']}/fund", json={}, headers=auth_headers(client_user["access_token"]))

    resp = client.post(f"/api/v1/milestones/{milestone['id']}/release", headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 404
