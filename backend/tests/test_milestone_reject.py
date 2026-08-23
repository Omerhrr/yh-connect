from tests.conftest import auth_headers
from tests.test_disputes import _post_project


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
    return project


def test_client_can_reject_unfunded_milestone_with_note(client, client_user, professional_user):
    project = _hire(client, client_user, professional_user)

    resp = client.post(
        f"/api/v1/projects/{project['id']}/milestones",
        json={"title": "Extra scope", "description": "", "amount": 80000},
        headers=auth_headers(professional_user["access_token"]),
    )
    assert resp.status_code == 201, resp.text
    milestone = resp.json()

    # Rejecting without a note is rejected.
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


def test_cannot_reject_a_funded_milestone(client, client_user, professional_user):
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

    resp = client.post(
        f"/api/v1/milestones/{milestone['id']}/reject",
        json={"note": "changed my mind"},
        headers=auth_headers(client_user["access_token"]),
    )
    assert resp.status_code == 400, resp.text


def test_only_client_can_reject(client, client_user, professional_user):
    project = _hire(client, client_user, professional_user)

    resp = client.post(
        f"/api/v1/projects/{project['id']}/milestones",
        json={"title": "Extra scope", "description": "", "amount": 80000},
        headers=auth_headers(professional_user["access_token"]),
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
