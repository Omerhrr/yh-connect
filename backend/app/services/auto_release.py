"""Lazy auto-release checks for milestones the client has gone quiet on.

There's no background job runner in this app, so instead of a cron/scheduler
this runs opportunistically whenever a project's milestones are loaded
(client or professional opening the project workspace) — cheap, always
eventually-consistent, and needs no new infra. Mirrors Upwork's "funds
release automatically if the client doesn't act" protection: a milestone
that's been funded/approved with delivered work sitting unreviewed for too
long releases to the professional on its own, with a heads-up notification
partway through the window so it's never a surprise.
"""

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models.milestone import Milestone, MilestoneStatus
from app.models.notification import NotificationType
from app.models.project import Project
from app.models.user import User
from app.services.escrow import disburse_milestone, EscrowActionError
from app.services.disputes import has_blocking_dispute
from app.services.notify import notify
from app.services.platform_settings import get_milestone_auto_release_days


def check_project_auto_release(db: Session, project: Project) -> None:
    """Check every eligible milestone on a project and either send a
    reminder or auto-release it. Commits internally per milestone so one bad
    milestone can't block the rest. Safe to call on every project load."""
    if not project.assigned_professional_id:
        return

    auto_release_days = get_milestone_auto_release_days(db)
    if auto_release_days <= 0:
        return  # admin disabled auto-release
    reminder_days = max(auto_release_days - 2, auto_release_days / 2)
    now = datetime.utcnow()

    for milestone in project.milestones:
        if milestone.status not in (MilestoneStatus.funded, MilestoneStatus.approved):
            continue
        if not milestone.submitted_at:
            continue  # never auto-release work that was never actually submitted
        if has_blocking_dispute(db, project.id, milestone.id):
            continue

        age = now - milestone.submitted_at
        if age >= timedelta(days=auto_release_days):
            try:
                disburse_milestone(
                    db, milestone, project, milestone.created_by or project.client_id,
                    note=f"Auto-released after {auto_release_days:.0f} days of client inactivity",
                )
            except EscrowActionError:
                continue
            notify(
                db, project.client_id, NotificationType.general,
                f"Milestone \"{milestone.title}\" auto-released",
                body=f"You didn't respond within {auto_release_days:.0f} days of the work being submitted, so ₦{milestone.amount:,.2f} was automatically released to the professional, as outlined in our payment terms.",
                link=f"/client/dashboard/projects/{project.id}", email_also=True,
            )
            db.commit()
        elif age >= timedelta(days=reminder_days) and not milestone.auto_release_reminder_sent:
            days_left = max(round(auto_release_days - age.total_seconds() / 86400), 1)
            notify(
                db, project.client_id, NotificationType.general,
                f"Review \"{milestone.title}\" soon",
                body=f"This milestone will auto-release ₦{milestone.amount:,.2f} to the professional in about {days_left} day{'s' if days_left != 1 else ''} if you don't approve or dispute it first.",
                link=f"/client/dashboard/projects/{project.id}", email_also=True,
            )
            milestone.auto_release_reminder_sent = True
            db.commit()


def release_due_withholds(db: Session, professional_id: str) -> None:
    """Credit any payment-protection holdbacks (see escrow.disburse_milestone)
    whose release date has passed into the professional's wallet balance.
    Same "no scheduler" pattern as check_project_auto_release above — this
    runs opportunistically whenever the professional views their earnings or
    transactions, or attempts a withdrawal, so a due holdback is never stuck
    waiting on a cron that doesn't exist. Commits internally per milestone."""
    now = datetime.utcnow()
    due = (
        db.query(Milestone)
        .join(Project, Milestone.project_id == Project.id)
        .filter(
            Project.assigned_professional_id == professional_id,
            Milestone.withheld_amount.isnot(None),
            Milestone.withheld_amount > 0,
            Milestone.withheld_released_at.is_(None),
            Milestone.withheld_release_at.isnot(None),
            Milestone.withheld_release_at <= now,
        )
        .all()
    )
    if not due:
        return

    professional = db.get(User, professional_id)
    if not professional:
        return

    for milestone in due:
        amount = milestone.withheld_amount
        professional.wallet_balance += amount
        milestone.withheld_released_at = now
        notify(
            db, professional_id, NotificationType.general,
            f"Held-back payment released for \"{milestone.title}\"",
            body=f"₦{amount:,.2f} that was held back as part of our payment protection window has now been added to your wallet balance.",
            link="/talent/dashboard/earnings", email_also=True,
        )
        db.commit()
