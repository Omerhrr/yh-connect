import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

os.environ["DATABASE_URL"] = "sqlite:////tmp/yhconnect_client_smoke.db"
if os.path.exists("/tmp/yhconnect_client_smoke.db"):
    os.remove("/tmp/yhconnect_client_smoke.db")
# KYC enforcement is off by default while the rest of the platform is still
# being built (see app/core/config.py). Turn it on here so this smoke test
# keeps exercising the gate + verification flow end to end.
os.environ["KYC_ENFORCEMENT_ENABLED"] = "true"

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402

with TestClient(app) as c:
    # --- register client + two professionals ---
    r = c.post("/api/v1/auth/register/client", json={
        "email": "client1@test.com", "password": "password123",
        "first_name": "Chidi", "last_name": "Okoro", "company_name": "Okoro Estates",
    })
    assert r.status_code == 201, r.text
    client_token = r.json()["access_token"]
    client_headers = {"Authorization": f"Bearer {client_token}"}

    cats = c.get("/api/v1/categories").json()
    cat_id = cats[0]["id"]

    r = c.post("/api/v1/auth/register/professional", json={
        "email": "pro1@test.com", "password": "password123",
        "first_name": "Amara", "last_name": "Nwosu", "title": "Structural Engineer",
        "category_id": cat_id, "skills": ["AutoCAD"],
    })
    assert r.status_code == 201, r.text
    pro1_token = r.json()["access_token"]
    pro1_id = r.json()["user"]["id"]
    pro1_headers = {"Authorization": f"Bearer {pro1_token}"}

    r = c.post("/api/v1/auth/register/professional", json={
        "email": "pro2@test.com", "password": "password123",
        "first_name": "Bola", "last_name": "Adeyemi", "title": "Architect",
        "category_id": cat_id, "skills": ["Revit"],
    })
    assert r.status_code == 201, r.text
    pro2_token = r.json()["access_token"]
    pro2_id = r.json()["user"]["id"]
    pro2_headers = {"Authorization": f"Bearer {pro2_token}"}

    # --- Phase D: client profile update ---
    r = c.patch("/api/v1/clients/me", json={
        "company_description": "Boutique real estate developer in Lagos",
        "company_website": "https://okoroestates.example",
        "company_logo_url": "https://example.com/logo.png",
    }, headers=client_headers)
    assert r.status_code == 200, r.text
    assert r.json()["company_description"] == "Boutique real estate developer in Lagos"
    print("client profile update: OK")

    # --- KYC: client must verify identity before contacting professionals ---
    r = c.post("/api/v1/projects/nonexistent/invite", json={"professional_id": pro1_id}, headers=client_headers)
    assert r.status_code == 403, r.text  # pre-KYC clients are blocked before anything else is checked

    r = c.post("/api/v1/clients/me/kyc", json={"nin": "12345678901", "dob": "1990-01-01"}, headers=client_headers)
    assert r.status_code == 200, r.text
    assert r.json()["kyc_status"] == "verified", r.text
    print("client KYC verification: OK")

    # --- post a project ---
    r = c.post("/api/v1/projects", json={
        "title": "3-Bedroom Duplex Structural Design", "description": "Full structural design needed",
        "category_id": cat_id, "budget_min": 500000, "budget_max": 900000,
    }, headers=client_headers)
    assert r.status_code == 201, r.text
    project = r.json()
    project_id = project["id"]
    assert project["client_company_name"] == "Okoro Estates"
    print("project created with client summary:", project["client_company_name"])

    # --- Phase A: two bids + shortlist + comparison fields ---
    r = c.post(f"/api/v1/projects/{project_id}/bids", json={"amount": 800000, "cover_letter": "I can do this"}, headers=pro1_headers)
    assert r.status_code == 201, r.text
    bid1_id = r.json()["id"]

    r = c.post(f"/api/v1/projects/{project_id}/bids", json={"amount": 750000, "cover_letter": "Also interested"}, headers=pro2_headers)
    assert r.status_code == 201, r.text
    bid2_id = r.json()["id"]

    r = c.get(f"/api/v1/projects/{project_id}/bids", headers=client_headers)
    assert r.status_code == 200, r.text
    bids = r.json()
    assert len(bids) == 2
    assert bids[0]["professional_name"] is not None
    assert "professional_rating" in bids[0]
    print("bid comparison fields present:", {k: bids[0][k] for k in ("professional_name", "professional_verification_status", "professional_rating")})

    r = c.patch(f"/api/v1/bids/{bid1_id}", json={"status": "shortlisted"}, headers=client_headers)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "shortlisted"
    print("shortlist: OK")

    # --- Phase A: invite a third professional directly ---
    r = c.post("/api/v1/auth/register/professional", json={
        "email": "pro3@test.com", "password": "password123",
        "first_name": "Femi", "last_name": "Balogun", "title": "Quantity Surveyor",
        "category_id": cat_id, "skills": ["BOQ"],
    })
    pro3_token = r.json()["access_token"]
    pro3_id = r.json()["user"]["id"]
    pro3_headers = {"Authorization": f"Bearer {pro3_token}"}

    r = c.post(f"/api/v1/projects/{project_id}/invite", json={
        "professional_id": pro3_id, "proposed_amount": 820000, "message": "We'd love to work with you",
    }, headers=client_headers)
    assert r.status_code == 201, r.text
    invite_id = r.json()["id"]
    print("invite created:", invite_id)

    r = c.get("/api/v1/invites/mine", headers=pro3_headers)
    assert r.status_code == 200 and len(r.json()) == 1, r.text

    r = c.patch(f"/api/v1/invites/{invite_id}", json={"status": "accepted"}, headers=pro3_headers)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "accepted"

    r = c.get(f"/api/v1/projects/{project_id}/bids", headers=client_headers)
    bids = r.json()
    assert len(bids) == 3, bids
    bid3 = [b for b in bids if b["professional_id"] == pro3_id][0]
    assert bid3["amount"] == 820000
    print("invite auto-created bid: OK, amount =", bid3["amount"])

    # accept pro1's bid
    r = c.patch(f"/api/v1/bids/{bid1_id}", json={"status": "accepted"}, headers=client_headers)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "accepted"

    r = c.get(f"/api/v1/projects/{project_id}", headers=client_headers)
    assert r.json()["status"] == "in_progress"
    assert r.json()["assigned_professional_id"] == pro1_id
    print("bid accepted, project in_progress: OK")

    # --- Phase B: messaging ---
    r = c.post(f"/api/v1/projects/{project_id}/messages", json={
        "recipient_id": pro1_id, "body": "Welcome aboard! Let's get started.",
    }, headers=client_headers)
    assert r.status_code == 201, r.text

    r = c.post(f"/api/v1/projects/{project_id}/messages", json={
        "recipient_id": project["client_id"], "body": "Thanks, excited to start!",
    }, headers=pro1_headers)
    assert r.status_code == 201, r.text

    r = c.get(f"/api/v1/projects/{project_id}/messages", headers=client_headers)
    assert r.status_code == 200
    thread = r.json()
    assert len(thread) == 2, thread
    print("project thread messages:", len(thread))

    r = c.get("/api/v1/messages/threads", headers=client_headers)
    assert r.status_code == 200
    threads = r.json()
    assert len(threads) == 1
    assert threads[0]["unread_count"] == 1
    print("threads list: OK, unread =", threads[0]["unread_count"])

    r = c.post(f"/api/v1/projects/{project_id}/messages/read", params={"other_user_id": pro1_id}, headers=client_headers)
    assert r.status_code == 200, r.text

    r = c.get("/api/v1/messages/threads", headers=client_headers)
    assert r.json()[0]["unread_count"] == 0
    print("mark thread read: OK")

    # --- Phase C: milestones -> change orders + reviews ---
    r = c.post(f"/api/v1/projects/{project_id}/milestones", json={
        "title": "Foundation design", "amount": 400000,
    }, headers=client_headers)
    assert r.status_code == 201, r.text
    milestone_id = r.json()["id"]

    r = c.post(f"/api/v1/projects/{project_id}/change-orders", json={
        "description": "Add extra rebar reinforcement", "amount_delta": 50000,
    }, headers=pro1_headers)
    assert r.status_code == 201, r.text
    co_id = r.json()["id"]
    print("change order proposed:", co_id)

    r = c.patch(f"/api/v1/change-orders/{co_id}", params={"status": "approved"}, headers=client_headers)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "approved"
    print("change order approved: OK")

    # review before completion should fail
    r = c.post("/api/v1/reviews", json={
        "project_id": project_id, "reviewee_id": pro1_id, "rating": 5, "comment": "Great!",
    }, headers=client_headers)
    assert r.status_code == 400, r.text
    print("review blocked before completion: OK")

    # fund + release to complete project
    r = c.post(f"/api/v1/milestones/{milestone_id}/submit", headers=pro1_headers)
    assert r.status_code == 200, r.text
    r = c.post(f"/api/v1/milestones/{milestone_id}/fund", json={}, headers=client_headers)
    assert r.status_code == 200, r.text
    r = c.post(f"/api/v1/milestones/{milestone_id}/approve", headers=client_headers)
    assert r.status_code == 200, r.text

    r = c.put("/api/v1/professionals/me/payout-details", json={
        "bank_code": "058", "bank_account_number": "0123456789",
    }, headers=pro1_headers)
    assert r.status_code == 200, r.text

    r = c.post(f"/api/v1/milestones/{milestone_id}/release", headers=client_headers)
    assert r.status_code == 200, r.text

    r = c.get(f"/api/v1/projects/{project_id}", headers=client_headers)
    assert r.json()["status"] == "completed", r.json()
    print("project completed: OK")

    # now review should succeed
    r = c.post("/api/v1/reviews", json={
        "project_id": project_id, "reviewee_id": pro1_id, "rating": 5, "comment": "Excellent work!",
    }, headers=client_headers)
    assert r.status_code == 201, r.text
    print("review after completion: OK")

    # duplicate review should fail
    r = c.post("/api/v1/reviews", json={
        "project_id": project_id, "reviewee_id": pro1_id, "rating": 4, "comment": "again",
    }, headers=client_headers)
    assert r.status_code == 409, r.text
    print("duplicate review blocked: OK")

    r = c.get(f"/api/v1/reviews/for/{pro1_id}")
    assert r.status_code == 200 and len(r.json()) == 1
    print("reviews for professional: OK")

    # --- Phase D: public client profile ---
    r = c.get(f"/api/v1/clients/{project['client_id']}")
    assert r.status_code == 200, r.text
    pub = r.json()
    assert pub["company_name"] == "Okoro Estates"
    assert pub["completed_project_count"] == 1
    print("public client profile:", pub)

    print("\nALL GOOD")
