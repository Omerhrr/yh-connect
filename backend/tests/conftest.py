import os
import tempfile
import uuid

import pytest

# Point at an isolated sqlite file *before* importing the app so
# app.core.config.settings picks it up. Each test session gets a fresh DB;
# the app's own startup event (run_migrations + seed_categories) builds the
# schema, mirroring exactly what happens in a real deploy.
_tmp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp_db.name}"
os.environ["KYC_ENFORCEMENT_ENABLED"] = "false"
os.environ["SECRET_KEY"] = "test-secret-key"
# Tests must be hermetic regardless of whatever real email provider the
# developer's local .env happens to have configured (e.g. SMTP creds for
# manual testing) — force email "not configured" so tests exercise the same
# behavior a fresh checkout would (email-gated features off), and always log
# rather than attempt a real network send if some path forgets to check.
os.environ["RESEND_API_KEY"] = ""
os.environ["SMTP_HOST"] = ""
os.environ["SMTP_USER"] = ""

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.core.limiter import limiter  # noqa: E402

# Rate limiting is exercised by hitting real endpoints repeatedly across many
# tests sharing one process/IP, disable it here so it doesn't interfere;
# the limiter itself is simple enough to not need its own dedicated test.
limiter.enabled = False


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def db_session_factory():
    from app.db.session import SessionLocal
    return SessionLocal


@pytest.fixture()
def client_user(client):
    email = f"client-{uuid.uuid4().hex[:10]}@example.com"
    resp = client.post(
        "/api/v1/auth/register/client",
        json={
            "email": email,
            "password": "password123",
            "first_name": "Cara",
            "last_name": "Client",
            "phone": "+2348000000001",
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.fixture()
def professional_user(client):
    email = f"pro-{uuid.uuid4().hex[:10]}@example.com"
    resp = client.post(
        "/api/v1/auth/register/professional",
        json={
            "email": email,
            "password": "password123",
            "first_name": "Paul",
            "last_name": "Pro",
            "phone": "+2348000000002",
            "title": "Structural Engineer",
            "category_id": "civil-structural-engineering",
            "skills": ["structural-analysis"],
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.fixture()
def admin_user(client, db_session_factory):
    """Admin registration is admin-only (no public bootstrap endpoint), so
    tests create the admin directly in the DB and mint a token the same way
    the login endpoint does."""
    from app.core.security import create_access_token, hash_password
    from app.models.user import User, UserRole

    db = db_session_factory()
    email = f"admin-{uuid.uuid4().hex[:10]}@example.com"
    user = User(
        email=email,
        hashed_password=hash_password("password123"),
        first_name="Ada",
        last_name="Min",
        role=UserRole.admin,
        is_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(user.id, {"role": user.role.value, "tv": user.token_version})
    result = {"access_token": token, "user": {"id": user.id, "email": user.email}}
    db.close()
    return result


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
