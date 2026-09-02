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

def _approve_contract_and_pay_fee(client, project_id, client_user, professional_user):
    """Bid acceptance auto-generates a contract + gates milestone funding on
    it being approved by both sides and the (default-zero) acceptance fee
    being paid — clear that gate so existing fund-and-go test flows keep
    working."""
    resp = client.get(f"/api/v1/projects/{project_id}/contract", headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 200, resp.text
    contract_id = resp.json()["id"]

    resp = client.post(
        f"/api/v1/contracts/{contract_id}/approve", headers=auth_headers(client_user["access_token"])
    )
    assert resp.status_code == 200, resp.text
    resp = client.post(
        f"/api/v1/contracts/{contract_id}/approve", headers=auth_headers(professional_user["access_token"])
    )
    assert resp.status_code == 200, resp.text

    resp = client.post(
        f"/api/v1/projects/{project_id}/acceptance-fee/pay", headers=auth_headers(professional_user["access_token"])
    )
    assert resp.status_code == 200, resp.text

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

    _approve_contract_and_pay_fee(client, project["id"], client_user, professional_user)

    resp = client.post(
        f"/api/v1/projects/{project['id']}/milestones",
        json={"title": "Milestone 1", "amount": 100000},
        headers=auth_headers(client_user["access_token"]),
    )
    assert resp.status_code == 201, resp.text
    milestone = resp.json()

    resp = client.post(
        "/api/v1/wallet/topup", json={"amount": 200000}, headers=auth_headers(client_user["access_token"])
    )
    assert resp.status_code == 200, resp.text

    resp = client.post(
        f"/api/v1/milestones/{milestone['id']}/fund", json={}, headers=auth_headers(client_user["access_token"])
    )
    assert resp.status_code == 200, resp.text

    return project, milestone["id"]

def test_dispute_blocks_release_until_resolved(client, client_user, professional_user, admin_user, db_session_factory):
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

    resp = client.post(
        "/api/v1/disputes",
        json={"project_id": project["id"], "milestone_id": milestone_id, "reason": "duplicate"},
        headers=auth_headers(client_user["access_token"]),
    )
    assert resp.status_code == 400

    resp = client.post(
        f"/api/v1/milestones/{milestone_id}/approve", headers=auth_headers(client_user["access_token"])
    )
    assert resp.status_code == 400
    assert "dispute" in resp.json()["detail"].lower()

    resp = client.post(
        f"/api/v1/disputes/{dispute['id']}/messages",
        json={"body": "I believe the work matches the agreed spec."},
        headers=auth_headers(professional_user["access_token"]),
    )
    assert resp.status_code == 201, resp.text

    resp = client.get(f"/api/v1/disputes/{dispute['id']}", headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 200
    detail = resp.json()
    assert len(detail["messages"]) == 1
    assert len(detail["events"]) == 1

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

    resp = client.get("/api/v1/wallet/transactions", headers=auth_headers(professional_user["access_token"]))
    assert resp.status_code == 200
    txs = resp.json()
    assert any(t["type"] == "release" and t["status"] == "successful" for t in txs)

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

    resp = client.post(
        f"/api/v1/disputes/{dispute['id']}/withdraw", headers=auth_headers(professional_user["access_token"])
    )
    assert resp.status_code == 403

    resp = client.post(
        f"/api/v1/disputes/{dispute['id']}/withdraw", headers=auth_headers(client_user["access_token"])
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "withdrawn"

    resp = client.post(
        f"/api/v1/milestones/{milestone_id}/approve", headers=auth_headers(client_user["access_token"])
    )
    assert resp.status_code == 200, resp.text

    resp = client.post(
        "/api/v1/wallet/withdraw",

        json={"amount": 90000},
        headers=auth_headers(professional_user["access_token"]),
    )
    assert resp.status_code == 400
    assert "payout" in resp.json()["detail"].lower()

def test_resolve_dispute_release_professional_pays_out(client, client_user, professional_user, admin_user):
    """Regression coverage for docs/AUDIT_2026-08-20.md finding #5: resolving
    with outcome=release_professional must actually move money, not just
    record the outcome."""
    project, milestone_id = _hire_and_fund(client, client_user, professional_user)
    resp = client.post(
        "/api/v1/disputes",
        json={"project_id": project["id"], "milestone_id": milestone_id, "reason": "Quality dispute"},
        headers=auth_headers(client_user["access_token"]),
    )
    dispute = resp.json()

    resp = client.patch(
        f"/api/v1/disputes/{dispute['id']}",
        json={"status": "resolved", "outcome": "release_professional", "resolution_note": "Work verified"},
        headers=auth_headers(admin_user["access_token"]),
    )
    assert resp.status_code == 200, resp.text

    resp = client.get("/api/v1/wallet/transactions", headers=auth_headers(professional_user["access_token"]))
    txs = resp.json()
    assert any(t["type"] == "release" and t["status"] == "successful" for t in txs)

    resp = client.get("/api/v1/projects/" + project["id"] + "/milestones", headers=auth_headers(client_user["access_token"]))
    milestone = next(m for m in resp.json() if m["id"] == milestone_id)
    assert milestone["status"] == "paid"

def test_resolve_dispute_refund_client(client, client_user, professional_user, admin_user):
    project, milestone_id = _hire_and_fund(client, client_user, professional_user)
    resp = client.post(
        "/api/v1/disputes",
        json={"project_id": project["id"], "milestone_id": milestone_id, "reason": "Non-delivery"},
        headers=auth_headers(client_user["access_token"]),
    )
    dispute = resp.json()

    resp = client.patch(
        f"/api/v1/disputes/{dispute['id']}",
        json={"status": "resolved", "outcome": "refund_client"},
        headers=auth_headers(admin_user["access_token"]),
    )
    assert resp.status_code == 200, resp.text

    resp = client.get("/api/v1/wallet/transactions", headers=auth_headers(client_user["access_token"]))
    txs = resp.json()
    assert any(t["type"] == "refund" and t["status"] == "successful" for t in txs)

def test_resolve_dispute_partial_split_moves_both_shares(client, client_user, professional_user, admin_user):
    """Regression coverage for the "partial split" fix: it must actually
    divide the milestone amount between both parties, not just record the
    outcome and leave the milestone claimable in full afterward."""
    project, milestone_id = _hire_and_fund(client, client_user, professional_user)
    resp = client.post(
        "/api/v1/disputes",
        json={"project_id": project["id"], "milestone_id": milestone_id, "reason": "Partially done"},
        headers=auth_headers(client_user["access_token"]),
    )
    dispute = resp.json()

    resp = client.patch(
        f"/api/v1/disputes/{dispute['id']}",
        json={"status": "resolved", "outcome": "partial_split"},
        headers=auth_headers(admin_user["access_token"]),
    )
    assert resp.status_code == 400

    resp = client.patch(
        f"/api/v1/disputes/{dispute['id']}",
        json={"status": "resolved", "outcome": "partial_split", "split_professional_amount": 60000},
        headers=auth_headers(admin_user["access_token"]),
    )
    assert resp.status_code == 200, resp.text

    resp = client.get("/api/v1/wallet/transactions", headers=auth_headers(professional_user["access_token"]))
    pro_txs = resp.json()
    release_tx = next(t for t in pro_txs if t["type"] == "release" and t["status"] == "successful")

    assert release_tx["amount"] == 57000.0

    resp = client.get("/api/v1/wallet/transactions", headers=auth_headers(client_user["access_token"]))
    client_txs = resp.json()
    refund_tx = next(t for t in client_txs if t["type"] == "refund" and t["status"] == "successful")
    assert refund_tx["amount"] == 40000.0

    resp = client.post(f"/api/v1/milestones/{milestone_id}/approve", headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 400

def test_resolve_dispute_no_action_blocked_when_milestone_linked(client, client_user, professional_user, admin_user):
    """Regression coverage for finding #5's second half: "no action" can't be
    used to quietly clear a milestone-scoped dispute out of blocking status
    while leaving the milestone claimable in full via the normal endpoint."""
    project, milestone_id = _hire_and_fund(client, client_user, professional_user)
    resp = client.post(
        "/api/v1/disputes",
        json={"project_id": project["id"], "milestone_id": milestone_id, "reason": "Some issue"},
        headers=auth_headers(client_user["access_token"]),
    )
    dispute = resp.json()

    resp = client.patch(
        f"/api/v1/disputes/{dispute['id']}",
        json={"status": "resolved", "outcome": "no_action"},
        headers=auth_headers(admin_user["access_token"]),
    )
    assert resp.status_code == 400

    resp = client.post(
        "/api/v1/disputes",
        json={"project_id": project["id"], "reason": "General communication issue"},
        headers=auth_headers(client_user["access_token"]),
    )
    general_dispute = resp.json()
    resp = client.patch(
        f"/api/v1/disputes/{general_dispute['id']}",
        json={"status": "resolved", "outcome": "no_action"},
        headers=auth_headers(admin_user["access_token"]),
    )
    assert resp.status_code == 200, resp.text

def test_project_completion_blocked_by_milestone_scoped_dispute(client, client_user, professional_user, admin_user):
    """Regression coverage for docs/AUDIT_2026-08-20.md finding #2: a dispute
    scoped to a specific (even already-paid) milestone must still block
    project completion, not just project-general disputes."""
    project, milestone_id = _hire_and_fund(client, client_user, professional_user)

    resp = client.post(f"/api/v1/milestones/{milestone_id}/approve", headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 200, resp.text

    resp = client.get(f"/api/v1/projects/{project['id']}", headers=auth_headers(client_user["access_token"]))
    assert resp.json()["status"] == "in_progress"

    resp = client.post(
        "/api/v1/disputes",
        json={"project_id": project["id"], "milestone_id": milestone_id, "category": "quality", "reason": "Quality issue found after payment"},
        headers=auth_headers(client_user["access_token"]),
    )
    assert resp.status_code == 201, resp.text

    resp = client.post(f"/api/v1/projects/{project['id']}/complete", headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 400
    assert "dispute" in resp.json()["detail"].lower()

def test_admin_wallet_adjustment(client, client_user, admin_user):
    resp = client.get("/api/v1/auth/me", headers=auth_headers(client_user["access_token"]))
    starting_balance = resp.json()["wallet_balance"]

    resp = client.post(
        f"/api/v1/admin/users/{client_user['user']['id']}/wallet",
        json={"amount": 5000, "note": "Goodwill credit"},
        headers=auth_headers(admin_user["access_token"]),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["type"] == "adjustment"

    resp = client.get("/api/v1/auth/me", headers=auth_headers(client_user["access_token"]))
    assert resp.json()["wallet_balance"] == starting_balance + 5000

    resp = client.post(
        f"/api/v1/admin/users/{client_user['user']['id']}/wallet",
        json={"amount": 0},
        headers=auth_headers(admin_user["access_token"]),
    )
    assert resp.status_code == 400

    resp = client.post(
        f"/api/v1/admin/users/{client_user['user']['id']}/wallet",
        json={"amount": -999999999},
        headers=auth_headers(admin_user["access_token"]),
    )
    assert resp.status_code == 400
