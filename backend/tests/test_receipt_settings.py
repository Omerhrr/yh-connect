from tests.conftest import auth_headers
from tests.test_disputes import _post_project

def test_receipt_settings_defaults(client, admin_user):
    resp = client.get("/api/v1/admin/receipt-settings", headers=auth_headers(admin_user["access_token"]))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["template"] == "modern"
    assert body["company_name"] == "YH Connect"

def test_update_receipt_settings_persists(client, admin_user):
    headers = auth_headers(admin_user["access_token"])
    resp = client.put(
        "/api/v1/admin/receipt-settings",
        json={"template": "classic", "primary_color": "#ff0000", "company_name": "Acme Corp", "font": "serif"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["template"] == "classic"
    assert body["primary_color"] == "#ff0000"
    assert body["company_name"] == "Acme Corp"
    assert body["font"] == "serif"

    assert body["tagline"] == "Nigeria's construction talent marketplace"

    resp = client.get("/api/v1/admin/receipt-settings", headers=headers)
    assert resp.json()["template"] == "classic"

def test_receipt_settings_requires_admin(client, client_user):
    resp = client.get("/api/v1/admin/receipt-settings", headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 403, resp.text

def test_receipt_preview_returns_pdf(client, admin_user):
    resp = client.get("/api/v1/admin/receipt-settings/preview", headers=auth_headers(admin_user["access_token"]))
    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.content[:4] == b"%PDF"

def test_downloaded_receipt_uses_saved_branding(client, client_user, professional_user, admin_user):
    headers_admin = auth_headers(admin_user["access_token"])
    client.put("/api/v1/admin/receipt-settings", json={"template": "minimal", "company_name": "Acme"}, headers=headers_admin)

    project = _post_project(client, client_user)
    resp = client.post(
        f"/api/v1/projects/{project['id']}/bids",
        json={"amount": 50000, "cover_letter": "hi", "estimated_days": 5},
        headers=auth_headers(professional_user["access_token"]),
    )
    bid = resp.json()
    client.patch(f"/api/v1/bids/{bid['id']}", json={"status": "accepted"}, headers=auth_headers(client_user["access_token"]))

    resp = client.post(
        f"/api/v1/projects/{project['id']}/milestones",
        json={"title": "Phase 1", "description": "", "amount": 20000},
        headers=auth_headers(client_user["access_token"]),
    )
    milestone = resp.json()
    client.post("/api/v1/wallet/topup", json={"amount": 200000}, headers=auth_headers(client_user["access_token"]))
    client.post(f"/api/v1/milestones/{milestone['id']}/fund", json={}, headers=auth_headers(client_user["access_token"]))

    resp = client.get("/api/v1/wallet/transactions", headers=auth_headers(client_user["access_token"]))
    tx_id = resp.json()[0]["id"]

    resp = client.get(f"/api/v1/wallet/transactions/{tx_id}/receipt", headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.content[:4] == b"%PDF"
