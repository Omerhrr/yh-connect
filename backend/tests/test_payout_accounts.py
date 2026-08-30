from tests.conftest import auth_headers

def test_add_payout_account_resolves_and_flags_name_mismatch(client, professional_user):
    """Local/simulated Monnify mode always resolves to 'Simulated Account
    Holder', which won't match the professional's real name (Paul Pro) — so
    this exercises the mismatch path, the one that matters for withdrawal
    safety."""
    resp = client.post(
        "/api/v1/professionals/me/payout-accounts",
        json={"bank_code": "058", "bank_name": "GTBank", "account_number": "0123456789"},
        headers=auth_headers(professional_user["access_token"]),
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["account_name"] == "Simulated Account Holder"
    assert body["name_match"] is False
    assert body["is_default"] is True

def test_cannot_add_duplicate_account(client, professional_user):
    payload = {"bank_code": "058", "bank_name": "GTBank", "account_number": "0123456789"}
    resp = client.post("/api/v1/professionals/me/payout-accounts", json=payload, headers=auth_headers(professional_user["access_token"]))
    assert resp.status_code == 201, resp.text
    resp = client.post("/api/v1/professionals/me/payout-accounts", json=payload, headers=auth_headers(professional_user["access_token"]))
    assert resp.status_code == 400, resp.text

def test_withdraw_blocked_when_default_account_name_mismatch(client, professional_user, db_session_factory):
    from app.models.user import User

    resp = client.post(
        "/api/v1/professionals/me/payout-accounts",
        json={"bank_code": "058", "bank_name": "GTBank", "account_number": "0123456789"},
        headers=auth_headers(professional_user["access_token"]),
    )
    assert resp.status_code == 201, resp.text

    db = db_session_factory()
    user = db.query(User).filter(User.id == professional_user["user"]["id"]).first()
    user.wallet_balance = 100000
    db.commit()
    db.close()

    resp = client.post("/api/v1/wallet/withdraw", json={"amount": 5000}, headers=auth_headers(professional_user["access_token"]))
    assert resp.status_code == 400, resp.text
    assert "doesn't match your profile name" in resp.json()["detail"]

def test_withdraw_succeeds_when_name_matches(client, professional_user, db_session_factory):
    from app.models.user import User
    from app.models.payout_account import PayoutAccount

    resp = client.post(
        "/api/v1/professionals/me/payout-accounts",
        json={"bank_code": "058", "bank_name": "GTBank", "account_number": "0123456789"},
        headers=auth_headers(professional_user["access_token"]),
    )
    account_id = resp.json()["id"]

    db = db_session_factory()
    account = db.get(PayoutAccount, account_id)
    account.name_match = True
    user = db.query(User).filter(User.id == professional_user["user"]["id"]).first()
    user.wallet_balance = 100000
    db.commit()
    db.close()

    resp = client.post("/api/v1/wallet/withdraw", json={"amount": 5000}, headers=auth_headers(professional_user["access_token"]))
    assert resp.status_code == 200, resp.text
    assert resp.json()["wallet_balance"] == 95000

def test_multiple_accounts_and_set_default(client, professional_user):
    headers = auth_headers(professional_user["access_token"])
    resp1 = client.post(
        "/api/v1/professionals/me/payout-accounts",
        json={"bank_code": "058", "bank_name": "GTBank", "account_number": "0123456789"},
        headers=headers,
    )
    resp2 = client.post(
        "/api/v1/professionals/me/payout-accounts",
        json={"bank_code": "011", "bank_name": "First Bank", "account_number": "9876543210"},
        headers=headers,
    )
    assert resp1.status_code == 201 and resp2.status_code == 201
    assert resp1.json()["is_default"] is True
    assert resp2.json()["is_default"] is False

    resp = client.patch(f"/api/v1/professionals/me/payout-accounts/{resp2.json()['id']}/default", headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["is_default"] is True

    resp = client.get("/api/v1/professionals/me/payout-accounts", headers=headers)
    accounts = {a["id"]: a for a in resp.json()}
    assert accounts[resp1.json()["id"]]["is_default"] is False
    assert accounts[resp2.json()["id"]]["is_default"] is True

def test_name_change_cooldown_blocks_rapid_second_change(client, professional_user):
    headers = auth_headers(professional_user["access_token"])
    resp = client.patch("/api/v1/auth/me", json={"first_name": "Paulo"}, headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["first_name"] == "Paulo"

    resp = client.patch("/api/v1/auth/me", json={"first_name": "Paulinho"}, headers=headers)
    assert resp.status_code == 400, resp.text
    assert "recently" in resp.json()["detail"].lower()

def test_name_change_cooldown_configurable_via_admin_settings(client, professional_user, admin_user):
    resp = client.patch(
        "/api/v1/admin/settings",
        json={"settings": {"profile_name_change_cooldown_hours": "0"}},
        headers=auth_headers(admin_user["access_token"]),
    )
    assert resp.status_code == 200, resp.text

    headers = auth_headers(professional_user["access_token"])
    resp = client.patch("/api/v1/auth/me", json={"first_name": "Paulo"}, headers=headers)
    assert resp.status_code == 200, resp.text
    resp = client.patch("/api/v1/auth/me", json={"first_name": "Paulinho"}, headers=headers)
    assert resp.status_code == 200, resp.text

def test_non_name_field_updates_unaffected_by_cooldown(client, professional_user):
    headers = auth_headers(professional_user["access_token"])
    resp = client.patch("/api/v1/auth/me", json={"first_name": "Paulo"}, headers=headers)
    assert resp.status_code == 200, resp.text
    resp = client.patch("/api/v1/auth/me", json={"phone": "+2348011112222"}, headers=headers)
    assert resp.status_code == 200, resp.text
