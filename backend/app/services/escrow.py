"""Shared escrow fund-movement helpers used by both the normal milestone
release flow (wallet.py) and dispute resolution (disputes.py), so a dispute
outcome moves real money through the exact same path as a normal payout
instead of a parallel, easier-to-drift implementation."""

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models.milestone import Milestone, MilestoneStatus
from app.models.notification import NotificationType
from app.models.project import Project
from app.models.user import User
from app.models.wallet import WalletTransaction, WalletTransactionStatus, WalletTransactionType
from app.services.notify import notify
from app.services.platform_settings import (
    get_platform_fee_percent,
    get_payment_withholding_percent,
    get_payment_withholding_release_days,
)


class EscrowActionError(Exception):
    pass


def disburse_milestone(db: Session, milestone: Milestone, project: Project, initiated_by_id: str, note: str) -> WalletTransaction:
    """Move a funded milestone's escrowed amount (minus platform fee) into the
    assigned professional's wallet balance. They withdraw to their bank
    separately, on their own schedule, via /wallet/withdraw. Caller commits."""
    if not project.assigned_professional_id:
        raise EscrowActionError("No professional assigned to this project")

    professional = db.get(User, project.assigned_professional_id)
    if not professional:
        raise EscrowActionError("Assigned professional not found")

    fee = round(milestone.amount * get_platform_fee_percent(db) / 100, 2)
    net_amount = milestone.amount - fee

    # Payment protection holdback: keep a configured percentage of this
    # payout back from the professional's wallet for a set number of days
    # instead of crediting it all instantly, giving the client a short
    # window to flag a problem before it's fully released. Disabled by
    # default (percent = 0). Only applies to the normal approve-and-release
    # path — dispute-resolution payouts (split_milestone) are already an
    # adjudicated outcome and release in full.
    withhold_percent = get_payment_withholding_percent(db)
    withheld_amount = round(net_amount * withhold_percent / 100, 2) if withhold_percent > 0 else 0.0
    released_now = net_amount - withheld_amount

    professional.wallet_balance += released_now

    if withheld_amount > 0:
        release_days = get_payment_withholding_release_days(db)
        milestone.withheld_amount = withheld_amount
        milestone.withheld_release_at = datetime.utcnow() + timedelta(days=release_days)
        milestone.withheld_released_at = None

    tx = WalletTransaction(
        project_id=project.id,
        milestone_id=milestone.id,
        client_id=project.client_id,
        professional_id=project.assigned_professional_id,
        type=WalletTransactionType.release,
        status=WalletTransactionStatus.successful,
        amount=released_now,
        platform_fee=fee,
        monnify_reference=None,
        note=note if withheld_amount <= 0 else f"{note} (₦{withheld_amount:,.2f} held back for {get_payment_withholding_release_days(db):.0f} days)",
    )
    db.add(tx)
    milestone.status = MilestoneStatus.paid
    # No automatic project-status transition here on purpose: milestones are
    # often added incrementally (e.g. "half now, rest later"), so "every
    # milestone that exists right now is closed" does NOT mean the project is
    # done, just that the ones defined so far are settled. Moving to "review"
    # used to happen automatically at this point and would hide the Add/
    # Propose Milestone action (only shown for `in_progress`) until the
    # client explicitly reopened the project, forcing an extra manual step
    # for a perfectly normal multi-milestone workflow. The client has an
    # explicit "Start Final Review" action (POST /projects/{id}/complete)
    # for when they're actually done, with the same guards this used to
    # duplicate (no open dispute, no milestone still holding escrow).
    if withheld_amount > 0:
        release_date = milestone.withheld_release_at.strftime("%b %-d, %Y") if milestone.withheld_release_at else "soon"
        notify(
            db, project.assigned_professional_id, NotificationType.milestone_released,
            f"Payout released for \"{milestone.title}\"",
            body=(
                f"₦{released_now:,.2f} has been added to your wallet balance now. "
                f"₦{withheld_amount:,.2f} is being held back as part of our standard payment "
                f"protection window and will be added automatically on {release_date}, "
                f"as long as no issue is raised on this milestone before then."
            ),
            link="/talent/dashboard/earnings", email_also=True,
        )
    else:
        notify(
            db, project.assigned_professional_id, NotificationType.milestone_released,
            f"Payout released for \"{milestone.title}\"",
            body=f"₦{net_amount:,.2f} has been added to your wallet balance. Withdraw it to your bank anytime from Earnings.",
            link="/talent/dashboard/earnings", email_also=True,
        )
    return tx


def split_milestone(
    db: Session,
    milestone: Milestone,
    project: Project,
    initiated_by_id: str,
    professional_amount: float,
    note: str,
) -> tuple[WalletTransaction, WalletTransaction]:
    """Dispute resolution "partial split": divide a funded/approved
    milestone's escrowed amount between the professional and the client
    instead of an all-or-nothing release/refund. `professional_amount` is the
    portion (before platform fee) going to the professional; the remainder
    goes back to the client. Both movements happen atomically as one
    resolution so the milestone can't be left half-settled. Caller commits."""
    if professional_amount < 0 or professional_amount > milestone.amount:
        raise EscrowActionError("Split amount must be between 0 and the milestone amount")

    client_amount = milestone.amount - professional_amount
    fee = round(professional_amount * get_platform_fee_percent(db) / 100, 2)
    net_to_professional = professional_amount - fee

    release_tx = None
    if professional_amount > 0:
        if not project.assigned_professional_id:
            raise EscrowActionError("No professional assigned to this project")
        professional = db.get(User, project.assigned_professional_id)
        if not professional:
            raise EscrowActionError("Assigned professional not found")
        professional.wallet_balance += net_to_professional
        release_tx = WalletTransaction(
            project_id=project.id,
            milestone_id=milestone.id,
            client_id=project.client_id,
            professional_id=project.assigned_professional_id,
            type=WalletTransactionType.release,
            status=WalletTransactionStatus.successful,
            amount=net_to_professional,
            platform_fee=fee,
            note=f"{note} (professional's share)",
        )
        db.add(release_tx)
        notify(
            db, project.assigned_professional_id, NotificationType.milestone_released,
            f"Partial payout for \"{milestone.title}\"",
            body=f"₦{net_to_professional:,.2f} has been added to your wallet balance as part of a dispute resolution split.",
            link="/talent/dashboard/earnings", email_also=True,
        )

    refund_tx = None
    if client_amount > 0:
        if project.client:
            project.client.wallet_balance += client_amount
        refund_tx = WalletTransaction(
            project_id=project.id,
            milestone_id=milestone.id,
            client_id=project.client_id,
            professional_id=project.assigned_professional_id,
            type=WalletTransactionType.refund,
            status=WalletTransactionStatus.successful,
            amount=client_amount,
            platform_fee=0.0,
            note=f"{note} (client's share)",
        )
        db.add(refund_tx)
        notify(
            db, project.client_id, NotificationType.general,
            f"₦{client_amount:,.2f} refunded for \"{milestone.title}\"",
            body=f"{note} (partial split resolution)",
            link=f"/client/dashboard/projects/{project.id}", email_also=True,
        )

    # Both shares are now settled, escrow holds nothing further for this
    # milestone. "paid" is the closer terminal status since at least a
    # decision moved real money (as opposed to a pure refund).
    milestone.status = MilestoneStatus.paid
    return release_tx, refund_tx


def refund_milestone(db: Session, milestone: Milestone, project: Project, initiated_by_id: str, note: str) -> WalletTransaction:
    """Return escrowed milestone funds to the client's wallet balance, ready
    to fund another milestone or be topped up further. Caller commits."""
    tx = WalletTransaction(
        project_id=project.id,
        milestone_id=milestone.id,
        client_id=project.client_id,
        professional_id=project.assigned_professional_id,
        type=WalletTransactionType.refund,
        status=WalletTransactionStatus.successful,
        amount=milestone.amount,
        platform_fee=0.0,
        note=note,
    )
    db.add(tx)
    if project.client:
        project.client.wallet_balance += milestone.amount
    milestone.status = MilestoneStatus.refunded
    notify(
        db, project.client_id, NotificationType.general,
        f"₦{milestone.amount:,.2f} refunded for \"{milestone.title}\"",
        body=note,
        link=f"/client/dashboard/projects/{project.id}", email_also=True,
    )
    return tx
