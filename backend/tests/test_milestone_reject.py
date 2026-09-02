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

def test_professional_cannot_create_milestones(client, client_user, professional_user):
    project = _hire(client, client_user, professional_user)
    resp = client.post(
        f"/api/v1/projects/{project['id']}/milestones",
        json={"title": "Extra scope", "description": "", "amount": 80000},
        headers=auth_headers(professional_user["access_token"]),
    )
    assert resp.status_code == 403, resp.text

def test_client_can_reject_unfunded_milestone_with_note(client, client_user, professional_user):
    project = _hire(client, client_user, professional_user)

    resp = client.post(
        f"/api/v1/projects/{project['id']}/milestones",
        json={"title": "Extra scope", "description": "", "amount": 80000},
        headers=auth_headers(client_user["access_token"]),
    )
    assert resp.status_code == 201, resp.text
    milestone = resp.json()

    resp = client.post(
        f"/api/v1/milestones/{milestone['id']}/reject",
        json={"note": "   "},
        headers=auth_headers(client_user["access_token"]),
    )
    assert resp.status_code == 400, resp.text

    resp = client.post(
        f"/api/v1/milestones/{milestone['id']}/reject",
        json={"note": "This wasn't agreed on, please discuss first."},
        headers=auth_headers(client_user["access_token"]),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "rejected"
    assert "wasn't agreed" in body["rejection_note"]
    assert body["rejected_at"] is not None

def test_rejecting_a_funded_milestone_refunds_the_client(client, client_user, professional_user):
    """Fund-before-work means most rejections now happen on an already-funded
    milestone — that must refund the escrowed amount back to the client
    rather than being blocked outright."""
    project = _hire(client, client_user, professional_user)

    resp = client.post(
        f"/api/v1/projects/{project['id']}/milestones",
        json={"title": "Main work", "description": "", "amount": 50000},
        headers=auth_headers(client_user["access_token"]),
    )
    milestone = resp.json()

    resp = client.post("/api/v1/wallet/topup", json={"amount": 500000}, headers=auth_headers(client_user["access_token"]))
    assert resp.status_code in (200, 201), resp.text

    resp = client.post(f"/api/v1/milestones/{milestone['id']}/fund", json={}, headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 200, resp.text

    balance_after_funding = client.get("/api/v1/auth/me", headers=auth_headers(client_user["access_token"])).json()["wallet_balance"]

    resp = client.post(
        f"/api/v1/milestones/{milestone['id']}/reject",
        json={"note": "changed my mind"},
        headers=auth_headers(client_user["access_token"]),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "refunded"
    assert body["rejection_note"] == "changed my mind"
    assert body["rejected_at"] is not None

    balance_after_refund = client.get("/api/v1/auth/me", headers=auth_headers(client_user["access_token"])).json()["wallet_balance"]
    assert balance_after_refund == balance_after_funding + 50000

    resp = client.post(
        f"/api/v1/milestones/{milestone['id']}/reject",
        json={"note": "again"},
        headers=auth_headers(client_user["access_token"]),
    )
    assert resp.status_code == 400, resp.text

def test_only_client_can_reject(client, client_user, professional_user):
    project = _hire(client, client_user, professional_user)

    resp = client.post(
        f"/api/v1/projects/{project['id']}/milestones",
        json={"title": "Extra scope", "description": "", "amount": 80000},
        headers=auth_headers(client_user["access_token"]),
    )
    milestone = resp.json()

    resp = client.post(
        f"/api/v1/milestones/{milestone['id']}/reject",
        json={"note": "no"},
        headers=auth_headers(professional_user["access_token"]),
    )
    assert resp.status_code == 403, resp.text

def test_project_out_exposes_contract_amount(client, client_user, professional_user):
    project = _hire(client, client_user, professional_user, amount=80000)

    resp = client.get(f"/api/v1/projects/{project['id']}", headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 200, resp.text
    assert resp.json()["contract_amount"] == 80000
