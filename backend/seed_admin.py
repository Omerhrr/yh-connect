"""Create the first admin account in your real dev database.

The API's own admin-registration endpoint (POST /api/v1/admin/register)
requires you to already be logged in as an admin - a chicken-and-egg problem
for the very first admin. This script inserts the first admin directly into
whatever database DATABASE_URL (from your .env) points at, so you can then
log in normally at /admin/login and use the register-admin endpoint (or this
script again) for any additional admins.

Usage:
    python seed_admin.py                                  # uses defaults below
    python seed_admin.py you@example.com "SomePassword1"  # custom email/password
    python seed_admin.py you@example.com "SomePassword1" "First" "Last"

Safe to re-run: if the email already exists, it will just report that and exit
without touching the existing account.
"""
import sys

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.user import User, UserRole

DEFAULT_EMAIL = "admin@yhconnect.ng"
DEFAULT_PASSWORD = "AdminPass123!"


def main():
    email = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_EMAIL
    password = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_PASSWORD
    first_name = sys.argv[3] if len(sys.argv) > 3 else "Admin"
    last_name = sys.argv[4] if len(sys.argv) > 4 else "User"

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            print(f"An account with email '{email}' already exists (role={existing.role.value}). Nothing changed.")
            return

        admin = User(
            email=email,
            hashed_password=hash_password(password),
            first_name=first_name,
            last_name=last_name,
            role=UserRole.admin,
            is_verified=True,
            is_active=True,
        )
        db.add(admin)
        db.commit()
        print("Admin account created.")
        print(f"  Email:    {email}")
        print(f"  Password: {password}")
        print("Log in at /admin/login. Please change this password after first login.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
