from tests.conftest import auth_headers
from app.core.config import settings

def _post_project_payload():
    return {
        "title": "Renovate kitchen",
        "description": "Full kitchen renovation",
        "category_id": "civil-structural-engineering",
        "budget_min": 100000,
        "budget_max": 300000,
    }

def test_posting_allowed_with_unverified_email_when_email_not_configured(client, client_user):

    assert not settings.email_configured
    resp = client.post(
        "/api/v1/projects",
        json=_post_project_payload(),
        headers=auth_headers(client_user["access_token"]),
    )
    assert resp.status_code == 201, resp.text

def test_posting_blocked_with_unverified_email_when_email_configured(client, client_user):
    settings.RESEND_API_KEY = "test-key"
    try:
        resp = client.post(
            "/api/v1/projects",
            json=_post_project_payload(),
            headers=auth_headers(client_user["access_token"]),
        )
        assert resp.status_code == 403, resp.text
        assert "verify your email" in resp.json()["detail"].lower()
    finally:
        settings.RESEND_API_KEY = ""

def test_posting_allowed_once_email_verified(client, client_user, db_session_factory):
    from datetime import datetime, timezone
    from app.models.user import User

    settings.RESEND_API_KEY = "test-key"
    try:
        db = db_session_factory()
        try:
            user = db.query(User).filter(User.id == client_user["user"]["id"]).first()
            user.email_verified_at = datetime.now(timezone.utc)
            db.add(user)
            db.commit()
        finally:
            db.close()

        resp = client.post(
            "/api/v1/projects",
            json=_post_project_payload(),
            headers=auth_headers(client_user["access_token"]),
        )
        assert resp.status_code == 201, resp.text
    finally:
        settings.RESEND_API_KEY = ""
