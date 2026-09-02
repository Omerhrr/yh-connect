from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role
from app.db.session import get_db
from app.models.bid import Bid, BidStatus
from app.models.contract import Contract, ContractStatus
from app.models.notification import NotificationType
from app.models.project import Project
from app.models.user import User, UserRole
from app.models.wallet import WalletTransaction, WalletTransactionStatus, WalletTransactionType
from app.schemas.acceptance_fee import (
    AcceptanceFeePayResponse,
    AcceptanceFeeQuoteOut,
    AcceptanceFeeSettingsOut,
    AcceptanceFeeSettingsUpdate,
)
from app.services.acceptance_fee import (
    compute_acceptance_fee,
    get_acceptance_fee_settings,
    save_acceptance_fee_settings,
)
from app.services.notify import notify
from app.services.project_log import post_system_message

router = APIRouter(tags=["acceptance-fee"])


def _accepted_price(db: Session, project: Project) -> float:
    bid = (
        db.query(Bid)
        .filter(Bid.project_id == project.id, Bid.professional_id == project.assigned_professional_id, Bid.status == BidStatus.accepted)
        .first()
    )
    return bid.amount if bid else ((project.budget_min + project.budget_max) / 2)


def has_paid_acceptance_fee(db: Session, project_id: str, professional_id: str) -> bool:
    return (
        db.query(WalletTransaction)
        .filter(
            WalletTransaction.project_id == project_id,
            WalletTransaction.professional_id == professional_id,
            WalletTransaction.type == WalletTransactionType.acceptance_fee,
            WalletTransaction.status == WalletTransactionStatus.successful,
        )
        .first()
        is not None
    )


@router.get("/admin/settings/acceptance-fee", response_model=AcceptanceFeeSettingsOut)
def admin_get_acceptance_fee_settings(current_user: User = Depends(require_role(UserRole.admin)), db: Session = Depends(get_db)):
    return get_acceptance_fee_settings(db)


@router.put("/admin/settings/acceptance-fee", response_model=AcceptanceFeeSettingsOut)
def admin_save_acceptance_fee_settings(
    payload: AcceptanceFeeSettingsUpdate,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    updates = payload.model_dump(exclude_none=True)
    if "rules" in updates:
        updates["rules"] = [r if isinstance(r, dict) else r.model_dump() for r in updates["rules"]]
    return save_acceptance_fee_settings(db, updates)


@router.get("/projects/{project_id}/acceptance-fee", response_model=AcceptanceFeeQuoteOut)
def quote_acceptance_fee(project_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project or not project.assigned_professional_id:
        raise HTTPException(status_code=404, detail="Project or assignment not found")
    if current_user.id not in (project.assigned_professional_id, project.client_id) and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    amount = compute_acceptance_fee(db, project.assigned_professional_id, _accepted_price(db, project))
    paid = has_paid_acceptance_fee(db, project.id, project.assigned_professional_id)
    wallet_balance = 0.0
    if current_user.id == project.assigned_professional_id:
        wallet_balance = current_user.wallet_balance
    return AcceptanceFeeQuoteOut(amount=amount, paid=paid, wallet_balance=wallet_balance)


@router.post("/projects/{project_id}/acceptance-fee/pay", response_model=AcceptanceFeePayResponse)
def pay_acceptance_fee(
    project_id: str,
    current_user: User = Depends(require_role(UserRole.professional)),
    db: Session = Depends(get_db),
):
    project = db.get(Project, project_id)
    if not project or project.assigned_professional_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found or you're not assigned to it")

    contract = db.query(Contract).filter(Contract.project_id == project_id).first()
    if not contract or contract.status != ContractStatus.approved:
        raise HTTPException(status_code=400, detail="The contract must be approved by both parties before paying the acceptance fee")

    if has_paid_acceptance_fee(db, project_id, current_user.id):
        raise HTTPException(status_code=400, detail="The acceptance fee has already been paid for this project")

    amount = compute_acceptance_fee(db, current_user.id, _accepted_price(db, project))
    if amount <= 0:
        tx = WalletTransaction(
            project_id=project_id, milestone_id=None, client_id=None, professional_id=current_user.id,
            type=WalletTransactionType.acceptance_fee, status=WalletTransactionStatus.successful,
            amount=0.0, note="Acceptance fee (no fee applicable)",
        )
        db.add(tx)
        db.commit()
        db.refresh(tx)
        return AcceptanceFeePayResponse(transaction_id=tx.id, amount=0.0, wallet_balance=current_user.wallet_balance)

    if current_user.wallet_balance < amount:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient wallet balance. You have ₦{current_user.wallet_balance:,.2f}, need ₦{amount:,.2f}. Top up your wallet first.",
        )

    current_user.wallet_balance -= amount
    tx = WalletTransaction(
        project_id=project_id, milestone_id=None, client_id=None, professional_id=current_user.id,
        type=WalletTransactionType.acceptance_fee, status=WalletTransactionStatus.successful,
        amount=amount, note=f"Acceptance fee for \"{project.title}\"",
    )
    db.add(tx)
    post_system_message(db, project, current_user.id, f"✅ Acceptance fee of ₦{amount:,.2f} paid — work can now begin.")
    notify(
        db, project.client_id, NotificationType.general,
        f"Acceptance fee paid for \"{project.title}\"",
        body="The talent has paid the acceptance fee and can now begin work. You can fund milestones.",
        link=f"/client/dashboard/projects/{project.id}", email_also=True,
    )
    db.commit()
    db.refresh(tx)
    db.refresh(current_user)
    return AcceptanceFeePayResponse(transaction_id=tx.id, amount=amount, wallet_balance=current_user.wallet_balance)
