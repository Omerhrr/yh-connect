"""Destructive test-data reset tool. NOT wired into the API — CLI-only on
purpose, so nothing on the web app can trigger it by accident.

Two operations:

  --all             Wipe every non-admin row in the database (all projects,
                     bids, messages, wallets, disputes, ledger, etc.) but
                     keep: admin user accounts, and site config / reference
                     data (categories, platform_settings, content_pages,
                     site_content_blocks, faq_items, blog_posts,
                     homepage_highlights, state_settings). Use this to reset
                     the whole platform back to a "freshly deployed" state
                     for an end-to-end test pass.

  --user <email|id>  Delete one specific user and everything that belongs
                     only to them, without touching any other user's data.
                     Use this to re-test one person's flow (e.g. re-onboard
                     the same email as a brand new client/professional)
                     without resetting the whole platform.

Usage (run inside the api container):

    docker compose exec api python -m app.scripts.reset_data --all --yes
    docker compose exec api python -m app.scripts.reset_data --user someone@example.com --yes

Omit --yes to get an interactive confirmation prompt instead (recommended
the first time you run this against a real deployment).
"""
import argparse
import sys

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.user import User, UserRole

# Tables wiped in a full reset. TRUNCATE ... CASCADE lets Postgres resolve
# FK dependency order itself, and CASCADE also catches any table not listed
# here that references one that is (belt and braces against the schema
# drifting out from under this list over time).
WIPE_TABLES = [
    "dispute_messages",
    "dispute_events",
    "disputes",
    "message_reactions",
    "messages",
    "milestone_updates",
    "change_orders",
    "milestones",
    "contracts",
    "bids",
    "project_invites",
    "project_access_requests",
    "project_reports",
    "reviews",
    "favorites",
    "notifications",
    "password_reset_tokens",
    "payout_accounts",
    "portfolio_items",
    "certifications",
    "employment_history",
    "educations",
    "professional_profiles",
    "wallet_transactions",
    "ledger_entries",
    "ledger_transactions",
    "ledger_accounts",
    "projects",
]

# Config / reference data an admin has set up — never touched by either
# operation.
PRESERVED_TABLES = [
    "categories",
    "platform_settings",
    "content_pages",
    "site_content_blocks",
    "faq_items",
    "blog_posts",
    "homepage_highlights",
    "state_settings",
]


def wipe_all_except_admins(db: Session) -> None:
    table_list = ", ".join(WIPE_TABLES)
    db.execute(text(f"TRUNCATE TABLE {table_list} CASCADE"))
    result = db.execute(text("DELETE FROM users WHERE role != :admin_role"), {"admin_role": UserRole.admin.value})
    db.commit()
    print(f"Wiped all non-admin data. Deleted {result.rowcount} non-admin user(s). "
          f"Preserved: {', '.join(PRESERVED_TABLES)}, plus admin accounts.")


def _find_user(db: Session, identifier: str) -> User | None:
    if "@" in identifier:
        return db.query(User).filter(User.email == identifier).first()
    return db.get(User, identifier)


def delete_user(db: Session, identifier: str) -> None:
    user = _find_user(db, identifier)
    if not user:
        raise SystemExit(f"No user found matching '{identifier}'")
    if user.role == UserRole.admin:
        raise SystemExit(f"Refusing to delete admin account {user.email}. "
                          f"Demote it first if you really mean to.")

    uid = user.id
    p = {"uid": uid}

    if user.role == UserRole.client:
        # A client's own projects are deleted in full, including every
        # other party's activity on them (bids, messages, disputes, etc.)
        # -- that data has no meaning once the project it's about is gone.
        db.execute(text("""
            DELETE FROM dispute_messages WHERE dispute_id IN (
                SELECT id FROM disputes WHERE project_id IN (
                    SELECT id FROM projects WHERE client_id = :uid))
        """), p)
        db.execute(text("""
            DELETE FROM dispute_events WHERE dispute_id IN (
                SELECT id FROM disputes WHERE project_id IN (
                    SELECT id FROM projects WHERE client_id = :uid))
        """), p)
        db.execute(text("DELETE FROM disputes WHERE project_id IN (SELECT id FROM projects WHERE client_id = :uid)"), p)
        db.execute(text("DELETE FROM messages WHERE project_id IN (SELECT id FROM projects WHERE client_id = :uid)"), p)
        db.execute(text("""
            DELETE FROM milestone_updates WHERE milestone_id IN (
                SELECT id FROM milestones WHERE project_id IN (
                    SELECT id FROM projects WHERE client_id = :uid))
        """), p)
        db.execute(text("DELETE FROM change_orders WHERE project_id IN (SELECT id FROM projects WHERE client_id = :uid)"), p)
        db.execute(text("DELETE FROM milestones WHERE project_id IN (SELECT id FROM projects WHERE client_id = :uid)"), p)
        db.execute(text("DELETE FROM contracts WHERE project_id IN (SELECT id FROM projects WHERE client_id = :uid)"), p)
        db.execute(text("DELETE FROM bids WHERE project_id IN (SELECT id FROM projects WHERE client_id = :uid)"), p)
        db.execute(text("DELETE FROM project_invites WHERE project_id IN (SELECT id FROM projects WHERE client_id = :uid)"), p)
        db.execute(text("DELETE FROM project_access_requests WHERE project_id IN (SELECT id FROM projects WHERE client_id = :uid)"), p)
        db.execute(text("DELETE FROM reviews WHERE project_id IN (SELECT id FROM projects WHERE client_id = :uid)"), p)
        db.execute(text("DELETE FROM project_reports WHERE project_id IN (SELECT id FROM projects WHERE client_id = :uid)"), p)

        # Ledger: remove whole transactions this client's wallet was party
        # to (both sides of each transaction, so the books stay balanced —
        # partial removal would leave dangling unbalanced entries on the
        # platform-side accounts).
        db.execute(text("""
            DELETE FROM ledger_entries WHERE transaction_id IN (
                SELECT le.transaction_id FROM ledger_entries le
                JOIN ledger_accounts la ON la.id = le.account_id
                WHERE la.user_id = :uid)
        """), p)
        db.execute(text("""
            DELETE FROM ledger_transactions WHERE id NOT IN (SELECT DISTINCT transaction_id FROM ledger_entries)
        """))
        db.execute(text("DELETE FROM ledger_accounts WHERE user_id = :uid"), p)

        db.execute(text("DELETE FROM wallet_transactions WHERE client_id = :uid"), p)
        db.execute(text("DELETE FROM projects WHERE client_id = :uid"), p)

    else:  # professional
        # This professional's fingerprints on OTHER clients' (kept)
        # projects are removed surgically: null the nullable pointers,
        # delete the rows that can't be nulled (NOT NULL FK to users.id).
        db.execute(text("UPDATE projects SET assigned_professional_id = NULL WHERE assigned_professional_id = :uid"), p)
        db.execute(text("UPDATE milestones SET created_by = NULL WHERE created_by = :uid"), p)
        db.execute(text("UPDATE disputes SET resolved_by = NULL WHERE resolved_by = :uid"), p)
        db.execute(text("UPDATE disputes SET proposed_by = NULL WHERE proposed_by = :uid"), p)
        db.execute(text("UPDATE dispute_events SET actor_id = NULL WHERE actor_id = :uid"), p)
        db.execute(text("UPDATE wallet_transactions SET professional_id = NULL WHERE professional_id = :uid"), p)

        db.execute(text("""
            DELETE FROM dispute_messages WHERE dispute_id IN (
                SELECT id FROM disputes WHERE raised_by = :uid)
        """), p)
        db.execute(text("""
            DELETE FROM dispute_events WHERE dispute_id IN (
                SELECT id FROM disputes WHERE raised_by = :uid)
        """), p)
        db.execute(text("DELETE FROM disputes WHERE raised_by = :uid"), p)
        db.execute(text("DELETE FROM dispute_messages WHERE sender_id = :uid"), p)

        db.execute(text("DELETE FROM change_orders WHERE proposed_by = :uid"), p)
        db.execute(text("DELETE FROM contracts WHERE professional_id = :uid"), p)
        db.execute(text("DELETE FROM bids WHERE professional_id = :uid"), p)
        db.execute(text("DELETE FROM project_invites WHERE professional_id = :uid"), p)
        db.execute(text("DELETE FROM project_access_requests WHERE professional_id = :uid"), p)
        db.execute(text("DELETE FROM payout_accounts WHERE professional_id = :uid"), p)
        db.execute(text("DELETE FROM messages WHERE sender_id = :uid OR recipient_id = :uid"), p)
        db.execute(text("DELETE FROM reviews WHERE reviewer_id = :uid OR reviewee_id = :uid"), p)

        db.execute(text("""
            DELETE FROM ledger_entries WHERE transaction_id IN (
                SELECT le.transaction_id FROM ledger_entries le
                JOIN ledger_accounts la ON la.id = le.account_id
                WHERE la.user_id = :uid)
        """), p)
        db.execute(text("""
            DELETE FROM ledger_transactions WHERE id NOT IN (SELECT DISTINCT transaction_id FROM ledger_entries)
        """))
        db.execute(text("DELETE FROM ledger_accounts WHERE user_id = :uid"), p)

        # professional_profiles cascades portfolio_items/certifications/
        # employment_history/educations (all FK on profile_id).
        db.execute(text("""
            DELETE FROM portfolio_items WHERE profile_id IN (
                SELECT id FROM professional_profiles WHERE user_id = :uid)
        """), p)
        db.execute(text("""
            DELETE FROM certifications WHERE profile_id IN (
                SELECT id FROM professional_profiles WHERE user_id = :uid)
        """), p)
        db.execute(text("""
            DELETE FROM employment_history WHERE profile_id IN (
                SELECT id FROM professional_profiles WHERE user_id = :uid)
        """), p)
        db.execute(text("""
            DELETE FROM educations WHERE profile_id IN (
                SELECT id FROM professional_profiles WHERE user_id = :uid)
        """), p)
        db.execute(text("DELETE FROM professional_profiles WHERE user_id = :uid"), p)

    # Common to both roles.
    db.execute(text("DELETE FROM message_reactions WHERE user_id = :uid"), p)
    db.execute(text("DELETE FROM favorites WHERE user_id = :uid"), p)
    db.execute(text("DELETE FROM notifications WHERE user_id = :uid"), p)
    db.execute(text("DELETE FROM password_reset_tokens WHERE user_id = :uid"), p)
    db.execute(text("DELETE FROM project_reports WHERE reporter_id = :uid"), p)

    db.execute(text("DELETE FROM users WHERE id = :uid"), p)
    db.commit()
    print(f"Deleted user {user.email} ({user.role.value}, id={uid}) and all of their data.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Reset test data (destructive).")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--all", action="store_true", help="Wipe all non-admin data.")
    group.add_argument("--user", metavar="EMAIL_OR_ID", help="Delete one user and their data.")
    parser.add_argument("--yes", action="store_true", help="Skip the interactive confirmation prompt.")
    args = parser.parse_args()

    if not args.yes:
        target = "ALL non-admin data" if args.all else f"user '{args.user}' and all their data"
        confirm = input(f"This will permanently delete {target}. Type 'yes' to continue: ")
        if confirm.strip().lower() != "yes":
            print("Aborted.")
            sys.exit(1)

    db = SessionLocal()
    try:
        if args.all:
            wipe_all_except_admins(db)
        else:
            delete_user(db, args.user)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
