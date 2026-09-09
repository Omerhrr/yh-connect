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

    docker compose exec api python -m app.scripts.reset_data --all --dry-run
    docker compose exec api python -m app.scripts.reset_data --all --yes
    docker compose exec api python -m app.scripts.reset_data --user someone@example.com --dry-run
    docker compose exec api python -m app.scripts.reset_data --user someone@example.com --yes

Add --dry-run to either command to preview what would be deleted (row
counts per table) without changing anything — nothing is committed, and the
whole thing runs inside a transaction that gets rolled back at the end. Use
this first.

Omit --yes to get an interactive confirmation prompt instead (recommended
the first time you run this against a real deployment). --dry-run implies
no confirmation is needed since nothing is written.
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


def wipe_all_except_admins(db: Session, dry_run: bool = False) -> None:
    if dry_run:
        print("DRY RUN — nothing will be deleted. Row counts that WOULD be wiped:\n")
        total = 0
        for table in WIPE_TABLES:
            count = db.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar_one()
            total += count
            print(f"  {table:<28} {count}")
        non_admins = db.execute(
            text("SELECT COUNT(*) FROM users WHERE role != :admin_role"),
            {"admin_role": UserRole.admin.value},
        ).scalar_one()
        print(f"  {'users (non-admin)':<28} {non_admins}")
        print(f"\nTotal rows: {total + non_admins}")
        print(f"Preserved (untouched): {', '.join(PRESERVED_TABLES)}, plus admin accounts.")
        db.rollback()
        return

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


def delete_user(db: Session, identifier: str, dry_run: bool = False) -> None:
    user = _find_user(db, identifier)
    if not user:
        raise SystemExit(f"No user found matching '{identifier}'")
    if user.role == UserRole.admin:
        raise SystemExit(f"Refusing to delete admin account {user.email}. "
                          f"Demote it first if you really mean to.")

    uid = user.id
    p = {"uid": uid}
    counts: dict[str, int] = {}

    def run(label: str, sql: str, params: dict = p) -> None:
        result = db.execute(text(sql), params)
        counts[label] = counts.get(label, 0) + (result.rowcount or 0)

    if user.role == UserRole.client:
        # A client's own projects are deleted in full, including every
        # other party's activity on them (bids, messages, disputes, etc.)
        # -- that data has no meaning once the project it's about is gone.
        run("dispute_messages", """
            DELETE FROM dispute_messages WHERE dispute_id IN (
                SELECT id FROM disputes WHERE project_id IN (
                    SELECT id FROM projects WHERE client_id = :uid))
        """)
        run("dispute_events", """
            DELETE FROM dispute_events WHERE dispute_id IN (
                SELECT id FROM disputes WHERE project_id IN (
                    SELECT id FROM projects WHERE client_id = :uid))
        """)
        run("disputes", "DELETE FROM disputes WHERE project_id IN (SELECT id FROM projects WHERE client_id = :uid)")
        run("messages", "DELETE FROM messages WHERE project_id IN (SELECT id FROM projects WHERE client_id = :uid)")
        run("milestone_updates", """
            DELETE FROM milestone_updates WHERE milestone_id IN (
                SELECT id FROM milestones WHERE project_id IN (
                    SELECT id FROM projects WHERE client_id = :uid))
        """)
        run("change_orders", "DELETE FROM change_orders WHERE project_id IN (SELECT id FROM projects WHERE client_id = :uid)")
        run("milestones", "DELETE FROM milestones WHERE project_id IN (SELECT id FROM projects WHERE client_id = :uid)")
        run("contracts", "DELETE FROM contracts WHERE project_id IN (SELECT id FROM projects WHERE client_id = :uid)")
        run("bids", "DELETE FROM bids WHERE project_id IN (SELECT id FROM projects WHERE client_id = :uid)")
        run("project_invites", "DELETE FROM project_invites WHERE project_id IN (SELECT id FROM projects WHERE client_id = :uid)")
        run("project_access_requests", "DELETE FROM project_access_requests WHERE project_id IN (SELECT id FROM projects WHERE client_id = :uid)")
        run("reviews", "DELETE FROM reviews WHERE project_id IN (SELECT id FROM projects WHERE client_id = :uid)")
        run("project_reports (by project)", "DELETE FROM project_reports WHERE project_id IN (SELECT id FROM projects WHERE client_id = :uid)")

        # Ledger: remove whole transactions this client's wallet was party
        # to (both sides of each transaction, so the books stay balanced —
        # partial removal would leave dangling unbalanced entries on the
        # platform-side accounts).
        run("ledger_entries", """
            DELETE FROM ledger_entries WHERE transaction_id IN (
                SELECT le.transaction_id FROM ledger_entries le
                JOIN ledger_accounts la ON la.id = le.account_id
                WHERE la.user_id = :uid)
        """)
        run("ledger_transactions", """
            DELETE FROM ledger_transactions WHERE id NOT IN (SELECT DISTINCT transaction_id FROM ledger_entries)
        """, {})
        run("ledger_accounts", "DELETE FROM ledger_accounts WHERE user_id = :uid")

        run("wallet_transactions", "DELETE FROM wallet_transactions WHERE client_id = :uid")
        run("projects", "DELETE FROM projects WHERE client_id = :uid")

    else:  # professional
        # This professional's fingerprints on OTHER clients' (kept)
        # projects are removed surgically: null the nullable pointers,
        # delete the rows that can't be nulled (NOT NULL FK to users.id).
        run("projects.assigned_professional_id -> NULL", "UPDATE projects SET assigned_professional_id = NULL WHERE assigned_professional_id = :uid")
        run("milestones.created_by -> NULL", "UPDATE milestones SET created_by = NULL WHERE created_by = :uid")
        run("disputes.resolved_by -> NULL", "UPDATE disputes SET resolved_by = NULL WHERE resolved_by = :uid")
        run("disputes.proposed_by -> NULL", "UPDATE disputes SET proposed_by = NULL WHERE proposed_by = :uid")
        run("dispute_events.actor_id -> NULL", "UPDATE dispute_events SET actor_id = NULL WHERE actor_id = :uid")
        run("wallet_transactions.professional_id -> NULL", "UPDATE wallet_transactions SET professional_id = NULL WHERE professional_id = :uid")

        run("dispute_messages (raised disputes)", """
            DELETE FROM dispute_messages WHERE dispute_id IN (
                SELECT id FROM disputes WHERE raised_by = :uid)
        """)
        run("dispute_events (raised disputes)", """
            DELETE FROM dispute_events WHERE dispute_id IN (
                SELECT id FROM disputes WHERE raised_by = :uid)
        """)
        run("disputes (raised_by)", "DELETE FROM disputes WHERE raised_by = :uid")
        run("dispute_messages (sender)", "DELETE FROM dispute_messages WHERE sender_id = :uid")

        run("change_orders", "DELETE FROM change_orders WHERE proposed_by = :uid")
        run("contracts", "DELETE FROM contracts WHERE professional_id = :uid")
        run("bids", "DELETE FROM bids WHERE professional_id = :uid")
        run("project_invites", "DELETE FROM project_invites WHERE professional_id = :uid")
        run("project_access_requests", "DELETE FROM project_access_requests WHERE professional_id = :uid")
        run("payout_accounts", "DELETE FROM payout_accounts WHERE professional_id = :uid")
        run("messages", "DELETE FROM messages WHERE sender_id = :uid OR recipient_id = :uid")
        run("reviews", "DELETE FROM reviews WHERE reviewer_id = :uid OR reviewee_id = :uid")

        run("ledger_entries", """
            DELETE FROM ledger_entries WHERE transaction_id IN (
                SELECT le.transaction_id FROM ledger_entries le
                JOIN ledger_accounts la ON la.id = le.account_id
                WHERE la.user_id = :uid)
        """)
        run("ledger_transactions", """
            DELETE FROM ledger_transactions WHERE id NOT IN (SELECT DISTINCT transaction_id FROM ledger_entries)
        """, {})
        run("ledger_accounts", "DELETE FROM ledger_accounts WHERE user_id = :uid")

        # professional_profiles cascades portfolio_items/certifications/
        # employment_history/educations (all FK on profile_id).
        run("portfolio_items", """
            DELETE FROM portfolio_items WHERE profile_id IN (
                SELECT id FROM professional_profiles WHERE user_id = :uid)
        """)
        run("certifications", """
            DELETE FROM certifications WHERE profile_id IN (
                SELECT id FROM professional_profiles WHERE user_id = :uid)
        """)
        run("employment_history", """
            DELETE FROM employment_history WHERE profile_id IN (
                SELECT id FROM professional_profiles WHERE user_id = :uid)
        """)
        run("educations", """
            DELETE FROM educations WHERE profile_id IN (
                SELECT id FROM professional_profiles WHERE user_id = :uid)
        """)
        run("professional_profiles", "DELETE FROM professional_profiles WHERE user_id = :uid")

    # Common to both roles.
    run("message_reactions", "DELETE FROM message_reactions WHERE user_id = :uid")
    run("favorites", "DELETE FROM favorites WHERE user_id = :uid")
    run("notifications", "DELETE FROM notifications WHERE user_id = :uid")
    run("password_reset_tokens", "DELETE FROM password_reset_tokens WHERE user_id = :uid")
    run("project_reports (by reporter)", "DELETE FROM project_reports WHERE reporter_id = :uid")

    run("users", "DELETE FROM users WHERE id = :uid")

    if dry_run:
        db.rollback()
        print(f"DRY RUN — nothing will be deleted. Rows that WOULD be affected for "
              f"{user.email} ({user.role.value}, id={uid}):\n")
        total = 0
        for label, n in counts.items():
            if n:
                total += n
                print(f"  {label:<32} {n}")
        print(f"\nTotal rows affected: {total}")
        return

    db.commit()
    print(f"Deleted user {user.email} ({user.role.value}, id={uid}) and all of their data.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Reset test data (destructive).")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--all", action="store_true", help="Wipe all non-admin data.")
    group.add_argument("--user", metavar="EMAIL_OR_ID", help="Delete one user and their data.")
    parser.add_argument("--yes", action="store_true", help="Skip the interactive confirmation prompt.")
    parser.add_argument("--dry-run", action="store_true", help="Preview row counts without deleting anything.")
    args = parser.parse_args()

    if not args.dry_run and not args.yes:
        target = "ALL non-admin data" if args.all else f"user '{args.user}' and all their data"
        confirm = input(f"This will permanently delete {target}. Type 'yes' to continue: ")
        if confirm.strip().lower() != "yes":
            print("Aborted.")
            sys.exit(1)

    db = SessionLocal()
    try:
        if args.all:
            wipe_all_except_admins(db, dry_run=args.dry_run)
        else:
            delete_user(db, args.user, dry_run=args.dry_run)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
