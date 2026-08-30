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

def test_contract_amount_starts_equal_to_accepted_bid(client, client_user, professional_user):
    project = _hire(client, client_user, professional_user, amount=200000)
    resp = client.get(f"/api/v1/projects/{project['id']}", headers=auth_headers(client_user["access_token"]))
    body = resp.json()
    assert body["contract_amount"] == 200000
    assert body["milestones_total"] == 0
    assert body["remaining_unallocated"] == 200000

def test_remaining_unallocated_tracks_milestones(client, client_user, professional_user):
    project = _hire(client, client_user, professional_user, amount=200000)
    client.post(
        f"/api/v1/projects/{project['id']}/milestones",
        json={"title": "Phase 1", "description": "", "amount": 80000},
        headers=auth_headers(client_user["access_token"]),
    )
    resp = client.get(f"/api/v1/projects/{project['id']}", headers=auth_headers(client_user["access_token"]))
    body = resp.json()
    assert body["milestones_total"] == 80000
    assert body["remaining_unallocated"] == 120000

def test_approved_change_order_updates_contract_amount(client, client_user, professional_user):
    project = _hire(client, client_user, professional_user, amount=200000)
    resp = client.post(
        f"/api/v1/projects/{project['id']}/change-orders",
        json={"description": "Extra fencing", "amount_delta": 30000},
        headers=auth_headers(professional_user["access_token"]),
    )
    co = resp.json()

    resp = client.patch(f"/api/v1/change-orders/{co['id']}?status=approved", headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 200, resp.text

    resp = client.get(f"/api/v1/projects/{project['id']}", headers=auth_headers(client_user["access_token"]))
    assert resp.json()["contract_amount"] == 230000

def test_negative_change_order_reduces_contract_amount_even_without_milestone(client, client_user, professional_user):
    project = _hire(client, client_user, professional_user, amount=200000)
    resp = client.post(
        f"/api/v1/projects/{project['id']}/change-orders",
        json={"description": "Drop the gate, scope down", "amount_delta": -20000},
        headers=auth_headers(client_user["access_token"]),
    )
    co = resp.json()
    assert co["resulting_milestone_id"] is None

    resp = client.patch(f"/api/v1/change-orders/{co['id']}?status=approved", headers=auth_headers(professional_user["access_token"]))
    assert resp.status_code == 200, resp.text
    assert resp.json()["resulting_milestone_id"] is None

    resp = client.get(f"/api/v1/projects/{project['id']}", headers=auth_headers(client_user["access_token"]))
    assert resp.json()["contract_amount"] == 180000

def test_proposer_cannot_approve_own_change_order(client, client_user, professional_user):
    project = _hire(client, client_user, professional_user, amount=200000)
    resp = client.post(
        f"/api/v1/projects/{project['id']}/change-orders",
        json={"description": "Client-proposed addition", "amount_delta": 10000},
        headers=auth_headers(client_user["access_token"]),
    )
    co = resp.json()
    resp = client.patch(f"/api/v1/change-orders/{co['id']}?status=approved", headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 403, resp.text

def test_professional_can_approve_client_proposed_change_order(client, client_user, professional_user):
    project = _hire(client, client_user, professional_user, amount=200000)
    resp = client.post(
        f"/api/v1/projects/{project['id']}/change-orders",
        json={"description": "Client-proposed addition", "amount_delta": 10000},
        headers=auth_headers(client_user["access_token"]),
    )
    co = resp.json()
    resp = client.patch(f"/api/v1/change-orders/{co['id']}?status=approved", headers=auth_headers(professional_user["access_token"]))
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "approved"
    assert resp.json()["resulting_milestone_id"] is not None
