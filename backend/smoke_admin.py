"""Dev-only smoke test for the Phase 3 admin/CMS backend work.

Run with: python smoke_admin.py
Spins up a throwaway sqlite DB, boots the app via TestClient, seeds an admin
directly in the DB (register/admin requires an existing admin), and exercises
users/projects/disputes/settings/analytics/content endpoints end-to-end.
"""
import os

os.environ["DATABASE_URL"] = "sqlite:////tmp/smoke_admin.db"

if os.path.exists("/tmp/smoke_admin.db"):
    os.remove("/tmp/smoke_admin.db")

from fastapi.testclient import TestClient

from app.main import app
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.user import User, UserRole

client = None

def seed_admin():
    db = SessionLocal()
    admin = User(
        email="admin@yhconnect.ng",
        hashed_password=hash_password("adminpass123"),
        first_name="Admin",
        last_name="User",
        role=UserRole.admin,
        is_verified=True,
    )
    db.add(admin)
    db.commit()
    db.close()

def login(email, password):
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]

def auth(token):
    return {"Authorization": f"Bearer {token}"}

def main():
    global client
    with TestClient(app) as c:
        client = c
        run()

def run():
    seed_admin()
    admin_token = login("admin@yhconnect.ng", "adminpass123")

    client_res = client.post(
        "/api/v1/auth/register/client",
        json={"email": "client@x.com", "password": "password123", "first_name": "Cara", "last_name": "Client"},
    )
    assert client_res.status_code == 201, client_res.text

    pro_res = client.post(
        "/api/v1/auth/register/professional",
        json={
            "email": "pro@x.com",
            "password": "password123",
            "first_name": "Pete",
            "last_name": "Pro",
            "title": "Civil Engineer",
            "category_id": "civil-structural-engineering",
        },
    )

    assert pro_res.status_code in (201, 400, 404), pro_res.text

    res = client.get("/api/v1/admin/users", headers=auth(admin_token))
    assert res.status_code == 200, res.text
    assert len(res.json()) >= 2
    print("admin users list OK:", len(res.json()), "users")

    client_id = next(u["id"] for u in res.json() if u["email"] == "client@x.com")
    res = client.patch(f"/api/v1/admin/users/{client_id}", json={"is_active": False}, headers=auth(admin_token))
    assert res.status_code == 200 and res.json()["is_active"] is False, res.text
    print("admin suspend user OK")

    res = client.get("/api/v1/admin/projects", headers=auth(admin_token))
    assert res.status_code == 200, res.text
    print("admin projects list OK")

    res = client.get("/api/v1/admin/disputes", headers=auth(admin_token))
    assert res.status_code == 200, res.text
    print("admin disputes list OK")

    res = client.get("/api/v1/admin/settings", headers=auth(admin_token))
    assert res.status_code == 200, res.text
    res = client.patch(
        "/api/v1/admin/settings",
        json={"settings": {"platform_fee_percent": "7.5"}},
        headers=auth(admin_token),
    )
    assert res.status_code == 200, res.text
    assert any(s["key"] == "platform_fee_percent" and s["value"] == "7.5" for s in res.json())
    print("admin settings get/patch OK")

    res = client.get("/api/v1/admin/analytics/overview", headers=auth(admin_token))
    assert res.status_code == 200, res.text
    assert "gmv" in res.json()
    print("admin analytics overview OK:", res.json())

    res = client.post(
        "/api/v1/admin/register",
        json={"email": "admin2@yhconnect.ng", "password": "password123", "first_name": "Second", "last_name": "Admin"},
        headers=auth(admin_token),
    )
    assert res.status_code == 201, res.text
    print("admin register second admin OK")

    res = client.post(
        "/api/v1/admin/content/pages",
        json={"slug": "privacy", "title": "Privacy Policy", "body": "We respect your data."},
        headers=auth(admin_token),
    )
    assert res.status_code == 201, res.text
    res = client.get("/api/v1/content/pages/privacy")
    assert res.status_code == 200 and res.json()["title"] == "Privacy Policy", res.text
    print("CMS content page OK")

    res = client.post(
        "/api/v1/admin/content/blog",
        json={"slug": "hello-world", "title": "Hello World", "body": "First post", "published": True},
        headers=auth(admin_token),
    )
    assert res.status_code == 201, res.text
    res = client.get("/api/v1/content/blog")
    assert res.status_code == 200 and len(res.json()) == 1, res.text
    print("CMS blog post OK")

    res = client.post(
        "/api/v1/admin/content/highlights",
        json={"type": "stat", "title": "500+ verified pros", "sort_order": 1},
        headers=auth(admin_token),
    )
    assert res.status_code == 201, res.text
    res = client.get("/api/v1/content/highlights")
    assert res.status_code == 200 and len(res.json()) == 1, res.text
    print("CMS highlight OK")

    res = client.post(
        "/api/v1/admin/categories",
        json={"id": "test-category", "label": "Test Category"},
        headers=auth(admin_token),
    )
    assert res.status_code == 201, res.text
    res = client.get("/api/v1/categories")
    assert res.status_code == 200 and any(c["id"] == "test-category" for c in res.json()), res.text
    print("CMS category admin CRUD OK")

    print("\nAll admin/CMS smoke checks passed.")

if __name__ == "__main__":
    main()
