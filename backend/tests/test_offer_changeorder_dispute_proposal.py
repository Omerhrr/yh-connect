from datetime import datetime, timedelta

from tests.conftest import auth_headers
from tests.test_disputes import _post_project


def _post_and_bid(client, client_user, professional_user, amount=200000):
    project = _post_project(client, client_user)
    resp = client.post(
        f"/api/v1/projects/{project['id']}/bids",
        json={"amount": amount, "cover_letter": "I can do this", "estimated_days": 14},
        headers=auth_headers(professional_user["access_token"]),
    )
    assert resp.status_code == 201, resp.text
    return project, resp.json()


def test_offer_routes_through_confirmation(client, client_user, professional_user):
    project, bid = _post_and_bid(client, client_user, professional_user, amount=200000)

    # Client sends an offer at a different amount — bid becomes "offered",
    # project should NOT be assigned yet.
    resp = client.patch(
        f"/api/v1/bids/{bid['id']}",
        json={"status": "accepted", "offered_amount": 180000, "offer_note": "Can you do it for less?"},
        headers=auth_headers(client_user["access_token"]),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "offered"
    assert resp.json()["offered_amount"] == 180000

    resp = client.get(f"/api/v1/projects/{project['id']}", headers=auth_headers(client_user["access_token"]))
    assert resp.json()["status"] == "open"
    assert resp.json()["assigned_professional_id"] is None

    # Professional confirms — now it locks in at the offered amount.
    resp = client.post(f"/api/v1/bids/{bid['id']}/confirm-offer", json={}, headers=auth_headers(professional_user["access_token"]))
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "accepted"
    assert resp.json()["amount"] == 180000

    resp = client.get(f"/api/v1/projects/{project['id']}", headers=auth_headers(client_user["access_token"]))
    assert resp.json()["status"] == "in_progress"


def test_offer_can_be_declined(client, client_user, professional_user):
    project, bid = _post_and_bid(client, client_user, professional_user, amount=200000)
    resp = client.patch(
        f"/api/v1/bids/{bid['id']}",
        json={"status": "accepted", "offered_amount": 150000},
        headers=auth_headers(client_user["access_token"]),
    )
    assert resp.status_code == 200, resp.text

    resp = client.post(f"/api/v1/bids/{bid['id']}/decline-offer", json={"note": "Too low"}, headers=auth_headers(professional_user["access_token"]))
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "shortlisted"

    # Client can now just accept the original amount instead.
    resp = client.patch(f"/api/v1/bids/{bid['id']}", json={"status": "accepted"}, headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "accepted"
    assert resp.json()["amount"] == 200000


def test_change_order_approval_creates_milestone(client, client_user, professional_user):
    project, bid = _post_and_bid(client, client_user, professional_user, amount=200000)
    client.patch(f"/api/v1/bids/{bid['id']}", json={"status": "accepted"}, headers=auth_headers(client_user["access_token"]))

    resp = client.post(
        f"/api/v1/projects/{project['id']}/change-orders",
        json={"description": "Add a side gate", "amount_delta": 30000},
        headers=auth_headers(professional_user["access_token"]),
    )
    assert resp.status_code == 201, resp.text
    co = resp.json()

    resp = client.patch(f"/api/v1/change-orders/{co['id']}?status=approved", headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 200, resp.text
    approved = resp.json()
    assert approved["resulting_milestone_id"]

    resp = client.get(f"/api/v1/projects/{project['id']}/milestones", headers=auth_headers(client_user["access_token"]))
    milestones = resp.json()
    assert any(m["id"] == approved["resulting_milestone_id"] and m["amount"] == 30000 for m in milestones)


def test_change_order_no_cost_creates_no_milestone(client, client_user, professional_user):
    project, bid = _post_and_bid(client, client_user, professional_user, amount=200000)
    client.patch(f"/api/v1/bids/{bid['id']}", json={"status": "accepted"}, headers=auth_headers(client_user["access_token"]))

    resp = client.post(
        f"/api/v1/projects/{project['id']}/change-orders",
        json={"description": "Use a different paint color, same cost", "amount_delta": 0},
        headers=auth_headers(professional_user["access_token"]),
    )
    co = resp.json()
    resp = client.patch(f"/api/v1/change-orders/{co['id']}?status=approved", headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 200, resp.text
    assert resp.json()["resulting_milestone_id"] is None


def test_dispute_direct_resolution_accept_moves_funds(client, client_user, professional_user, db_session_factory):
    from tests.test_disputes import _hire_and_fund

    project, milestone_id = _hire_and_fund(client, client_user, professional_user)

    from app.models.profile import ProfessionalProfile
    db = db_session_factory()
    profile = db.query(ProfessionalProfile).filter(ProfessionalProfile.user_id == professional_user["user"]["id"]).first()
    profile.bank_code = "044"
    profile.bank_account_number = "0123456789"
    profile.bank_account_name = "Paul Pro"
    db.commit()
    db.close()

    resp = client.post(
        "/api/v1/disputes",
        json={"project_id": project["id"], "milestone_id": milestone_id, "category": "quality", "reason": "Not quite right"},
        headers=auth_headers(client_user["access_token"]),
    )
    dispute = resp.json()

    # Professional proposes releasing the funds to themselves.
    resp = client.post(
        f"/api/v1/disputes/{dispute['id']}/propose-resolution",
        json={"outcome": "release_professional", "note": "Work is done, please release"},
        headers=auth_headers(professional_user["access_token"]),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["proposal_status"] == "pending"

    # The proposer can't respond to their own proposal.
    resp = client.post(f"/api/v1/disputes/{dispute['id']}/respond-proposal", json={"accept": True}, headers=auth_headers(professional_user["access_token"]))
    assert resp.status_code == 403

    resp = client.post(f"/api/v1/disputes/{dispute['id']}/respond-proposal", json={"accept": True}, headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "resolved"
    assert body["outcome"] == "release_professional"


def test_dispute_proposal_auto_accepts_after_window(client, client_user, professional_user, db_session_factory):
    from tests.test_disputes import _hire_and_fund

    project, milestone_id = _hire_and_fund(client, client_user, professional_user)

    from app.models.profile import ProfessionalProfile
    db = db_session_factory()
    profile = db.query(ProfessionalProfile).filter(ProfessionalProfile.user_id == professional_user["user"]["id"]).first()
    profile.bank_code = "044"
    profile.bank_account_number = "0123456789"
    profile.bank_account_name = "Paul Pro"
    db.commit()
    db.close()

    resp = client.post(
        "/api/v1/disputes",
        json={"project_id": project["id"], "milestone_id": milestone_id, "category": "payment", "reason": "Dispute"},
        headers=auth_headers(client_user["access_token"]),
    )
    dispute_id = resp.json()["id"]

    resp = client.post(
        f"/api/v1/disputes/{dispute_id}/propose-resolution",
        json={"outcome": "refund_client"},
        headers=auth_headers(client_user["access_token"]),
    )
    assert resp.status_code == 200, resp.text

    from app.models.dispute import Dispute
    db = db_session_factory()
    d = db.get(Dispute, dispute_id)
    d.proposal_expires_at = datetime.utcnow() - timedelta(hours=1)
    db.commit()
    db.close()

    resp = client.get(f"/api/v1/disputes/{dispute_id}", headers=auth_headers(professional_user["access_token"]))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "resolved"
    assert body["outcome"] == "refund_client"
    assert body["proposal_status"] == "accepted"
