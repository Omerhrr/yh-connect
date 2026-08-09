from tests.conftest import auth_headers


def _post_project(client, client_user):
    resp = client.post(
        "/api/v1/projects",
        json={
            "title": "Build a fence",
            "description": "Perimeter fence with gate",
            "category_id": "civil-structural-engineering",
            "budget_min": 100000,
            "budget_max": 300000,
            "location": "Ikeja, Lagos",
        },
        headers=auth_headers(client_user["access_token"]),
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _hire_and_fund(client, client_user, professional_user):
    """Post a project, accept a bid, create+fund a milestone. Returns (project, milestone_id)."""
    project = _post_project(client, client_user)
    resp = client.post(
        f"/api/v1/projects/{project['id']}/bids",
        json={"amount": 200000, "cover_letter": "I can do this", "estimated_days": 14},
        headers=auth_headers(professional_user["access_token"]),
    )
    assert resp.status_code == 201, resp.text
    bid = resp.json()

    resp = client.patch(
        f"/api/v1/bids/{bid['id']}", json={"status": "accepted"}, headers=auth_headers(client_user["access_token"])
    )
    assert resp.status_code == 200

    resp = client.post(
        f"/api/v1/projects/{project['id']}/milestones",
        json={"title": "Milestone 1", "amount": 100000},
        headers=auth_headers(client_user["access_token"]),
    )
    assert resp.status_code == 201, resp.text
    milestone = resp.json()

    resp = client.post(
        f"/api/v1/milestones/{milestone['id']}/fund", json={}, headers=auth_headers(client_user["access_token"])
    )
    assert resp.status_code == 200, resp.text

    return project, milestone["id"]


def test_dispute_blocks_release_until_resolved(client, client_user, professional_user, admin_user, db_session_factory):
    project, milestone_id = _hire_and_fund(client, client_user, professional_user)

    # Professional sets up payout details so a release would otherwise succeed.
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
        json={
            "project_id": project["id"],
            "milestone_id": milestone_id,
            "category": "quality",
            "reason": "The fence panels are the wrong height",
            "evidence_urls": ["https://example.com/evidence1.jpg"],
        },
        headers=auth_headers(client_user["access_token"]),
    )
    assert resp.status_code == 201, resp.text
    dispute = resp.json()
    assert dispute["status"] == "open"
    assert dispute["category"] == "quality"
    assert dispute["evidence_urls"] == ["https://example.com/evidence1.jpg"]
    assert dispute["other_party_name"]

    # Can't open a second dispute on the same milestone while one is active.
    resp = client.post(
        "/api/v1/disputes",
        json={"project_id": project["id"], "milestone_id": milestone_id, "reason": "duplicate"},
        headers=auth_headers(client_user["access_token"]),
    )
    assert resp.status_code == 400

    # Release is blocked while the dispute is open.
    resp = client.post(
        f"/api/v1/milestones/{milestone_id}/release", headers=auth_headers(client_user["access_token"])
    )
    assert resp.status_code == 400
    assert "dispute" in resp.json()["detail"].lower()

    # Other party can post a message on the case.
    resp = client.post(
        f"/api/v1/disputes/{dispute['id']}/messages",
        json={"body": "I believe the work matches the agreed spec."},
        headers=auth_headers(professional_user["access_token"]),
    )
    assert resp.status_code == 201, resp.text

    # Both parties can fetch the full case detail with the message thread.
    resp = client.get(f"/api/v1/disputes/{dispute['id']}", headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 200
    detail = resp.json()
    assert len(detail["messages"]) == 1
    assert len(detail["events"]) == 1  # the "filed" event

    # Admin resolves in favor of releasing to the professional -> real payout happens.
    resp = client.patch(
        f"/api/v1/disputes/{dispute['id']}",
        json={"status": "resolved", "outcome": "release_professional", "resolution_note": "Work verified against spec"},
        headers=auth_headers(admin_user["access_token"]),
    )
    assert resp.status_code == 200, resp.text
    resolved = resp.json()
    assert resolved["status"] == "resolved"
    assert resolved["outcome"] == "release_professional"
    assert resolved["resolved_by_name"]
    assert any(e["to_status"] == "resolved" for e in resolved["events"])

    # Milestone was actually paid out via the shared escrow helper.
    resp = client.get("/api/v1/wallet/transactions", headers=auth_headers(professional_user["access_token"]))
    assert resp.status_code == 200
    txs = resp.json()
    assert any(t["type"] == "release" and t["status"] == "successful" for t in txs)

    # Once resolved, no more messages can be added.
    resp = client.post(
        f"/api/v1/disputes/{dispute['id']}/messages",
        json={"body": "too late"},
        headers=auth_headers(client_user["access_token"]),
    )
    assert resp.status_code == 400


def test_raiser_can_withdraw_dispute(client, client_user, professional_user):
    project, milestone_id = _hire_and_fund(client, client_user, professional_user)

    resp = client.post(
        "/api/v1/disputes",
        json={"project_id": project["id"], "milestone_id": milestone_id, "reason": "Change of mind"},
        headers=auth_headers(client_user["access_token"]),
    )
    dispute = resp.json()

    # Professional (not the raiser) cannot withdraw it.
    resp = client.post(
        f"/api/v1/disputes/{dispute['id']}/withdraw", headers=auth_headers(professional_user["access_token"])
    )
    assert resp.status_code == 403

    resp = client.post(
        f"/api/v1/disputes/{dispute['id']}/withdraw", headers=auth_headers(client_user["access_token"])
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "withdrawn"

    # Fund release is no longer blocked once withdrawn.
    from app.models.profile import ProfessionalProfile

    resp = client.post(
        f"/api/v1/milestones/{milestone_id}/release", headers=auth_headers(client_user["access_token"])
    )
    # Will fail for a different reason now (no payout details set up), not the dispute.
    assert resp.status_code == 400
    assert "dispute" not in resp.json()["detail"].lower()
