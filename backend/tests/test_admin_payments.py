from tests.conftest import auth_headers

def test_admin_wallet_transactions_count_and_filters(client, client_user, admin_user):

    resp = client.post(
        "/api/v1/wallet/topup", json={"amount": 50000}, headers=auth_headers(client_user["access_token"])
    )
    assert resp.status_code == 200, resp.text

    headers = auth_headers(admin_user["access_token"])

    resp = client.get("/api/v1/admin/wallet/transactions/count", headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["total"] >= 1

    resp = client.get("/api/v1/admin/wallet/transactions?type_filter=topup", headers=headers)
    assert resp.status_code == 200
    assert all(t["type"] == "topup" for t in resp.json())

    q = client_user["user"]["first_name"]
    resp = client.get(f"/api/v1/admin/wallet/transactions?q={q}", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1

    resp = client.get(
        "/api/v1/admin/wallet/transactions?date_from=2000-01-01T00:00:00&date_to=2000-01-02T00:00:00",
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json() == []

    resp = client.get("/api/v1/admin/wallet/summary", headers=headers)
    assert resp.status_code == 200, resp.text
    summary = resp.json()
    assert summary["total_topped_up"] >= 50000
    assert "total_held_in_disputes" in summary
    assert "stuck_pending_count" in summary

def test_admin_wallet_transactions_export_is_csv(client, client_user, admin_user):
    resp = client.post(
        "/api/v1/wallet/topup", json={"amount": 10000}, headers=auth_headers(client_user["access_token"])
    )
    assert resp.status_code == 200

    headers = auth_headers(admin_user["access_token"])
    resp = client.get("/api/v1/admin/wallet/transactions/export", headers=headers)
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    body = resp.text
    assert "Date,Type,Status,Amount" in body.splitlines()[0]
    assert "topup" in body

def test_admin_wallet_endpoints_require_admin(client, client_user):
    headers = auth_headers(client_user["access_token"])
    resp = client.get("/api/v1/admin/wallet/transactions/count", headers=headers)
    assert resp.status_code == 403
    resp = client.get("/api/v1/admin/wallet/transactions/export", headers=headers)
    assert resp.status_code == 403
