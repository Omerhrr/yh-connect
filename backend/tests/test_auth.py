from tests.conftest import auth_headers


def test_register_client_and_login(client, client_user):
    assert client_user["user"]["role"] == "client"
    assert client_user["user"]["email_verified"] is False
    email = client_user["user"]["email"]

    resp = client.post("/api/v1/auth/login", json={"email": email, "password": "password123"})
    assert resp.status_code == 200
    assert resp.json()["access_token"]


def test_duplicate_email_rejected(client, client_user):
    resp = client.post(
        "/api/v1/auth/register/client",
        json={
            "email": client_user["user"]["email"],
            "password": "password123",
            "first_name": "Dup",
            "last_name": "User",
        },
    )
    assert resp.status_code == 409


def test_login_wrong_password_rejected(client, client_user):
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": client_user["user"]["email"], "password": "wrong-password"},
    )
    assert resp.status_code == 401


def test_me_requires_auth(client):
    resp = client.get("/api/v1/auth/me")
    assert resp.status_code == 401


def test_me_with_token(client, client_user):
    resp = client.get("/api/v1/auth/me", headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 200
    assert resp.json()["email"] == client_user["user"]["email"]


def test_password_reset_flow(client, client_user, db_session_factory):
    resp = client.post(
        "/api/v1/auth/forgot-password", json={"email": client_user["user"]["email"]}
    )
    assert resp.status_code == 200

    from app.models.auth_token import PasswordResetToken

    db = db_session_factory()
    try:
        reset = db.query(PasswordResetToken).order_by(PasswordResetToken.created_at.desc()).first()
        assert reset is not None
    finally:
        db.close()

    # Can't recover the raw token from the hash (that's the point), so
    # exercise the reject path instead: an invalid token must be refused.
    resp = client.post(
        "/api/v1/auth/reset-password", json={"token": "not-a-real-token", "new_password": "newpassword123"}
    )
    assert resp.status_code == 400


def test_forgot_password_does_not_leak_account_existence(client):
    resp = client.post("/api/v1/auth/forgot-password", json={"email": "nobody@example.com"})
    assert resp.status_code == 200


def test_logout_everywhere_invalidates_old_token(client, client_user):
    old_token = client_user["access_token"]
    resp = client.post("/api/v1/auth/logout-everywhere", headers=auth_headers(old_token))
    assert resp.status_code == 200
    new_token = resp.json()["access_token"]
    assert new_token != old_token

    # Old token should no longer work.
    resp = client.get("/api/v1/auth/me", headers=auth_headers(old_token))
    assert resp.status_code == 401

    # New token still works.
    resp = client.get("/api/v1/auth/me", headers=auth_headers(new_token))
    assert resp.status_code == 200
