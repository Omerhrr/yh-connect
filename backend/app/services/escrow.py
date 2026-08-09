"""Shared escrow fund-movement helpers used by both the normal milestone
release flow (wallet.py) and dispute resolution (disputes.py), so a dispute
outcome moves real money through the exact same path as a normal payout
instead of a parallel, easier-to-drift implementation."""

from datetime import datetime

from sqlalchemy.orm import Session

from app.models.milestone import Milestone, MilestoneStatus
from app.models.notification import NotificationType
from app.models.project import Project, ProjectStatus
from app.models.user import User
from app.models.wallet import WalletTransaction, WalletTransactionStatus, WalletTransactionType
from app.services.notify import notify
from app.services.platform_settings import get_platform_fee_percent


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

    professional.wallet_balance += net_amount

    tx = WalletTransaction(
        project_id=project.id,
        milestone_id=milestone.id,
        client_id=project.client_id,
        professional_id=project.assigned_professional_id,
        type=WalletTransactionType.release,
        status=WalletTransactionStatus.successful,
        amount=net_amount,
        platform_fee=fee,
        monnify_reference=None,
        note=note,
    )
    db.add(tx)
    milestone.status = MilestoneStatus.paid
    if all(m.status == MilestoneStatus.paid for m in project.milestones):
        project.status = ProjectStatus.completed
        project.completed_at = datetime.utcnow()
    notify(
        db, project.assigned_professional_id, NotificationType.milestone_released,
        f"Payout released for \"{milestone.title}\"",
        body=f"₦{net_amount:,.2f} has been added to your wallet balance. Withdraw it to your bank anytime from Earnings.",
        link="/talent/dashboard/earnings", email_also=True,
    )
    return tx


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
