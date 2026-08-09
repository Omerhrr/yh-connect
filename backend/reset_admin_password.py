"""Reset an existing admin account's password in your real dev database.

IMPORTANT: Stop your backend server (Ctrl+C) before running this script,
then restart it after. If the server is running while you edit the database
directly, its live connection can overwrite your change on its next write,
which is why a direct DB edit didn't stick.

Usage:
    python reset_admin_password.py                                  # uses defaults below
    python reset_admin_password.py you@example.com "NewPassword1!"  # custom email/password
"""
import sys

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.user import User, UserRole

DEFAULT_EMAIL = "admin@yhub.com"
DEFAULT_PASSWORD = "YhAdmin2026!"


def main():
    email = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_EMAIL
    password = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_PASSWORD

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print(f"No account found with email '{email}'.")
            return
        if user.role != UserRole.admin:
            print(f"Account '{email}' exists but its role is '{user.role.value}', not admin. Nothing changed.")
            return

        user.hashed_password = hash_password(password)
        db.commit()
        print("Password reset.")
        print(f"  Email:    {email}")
        print(f"  Password: {password}")
        print("Now start your backend server and log in at /admin/login.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
