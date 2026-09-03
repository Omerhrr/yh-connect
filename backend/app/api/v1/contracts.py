from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role
from app.db.session import get_db
from app.models.contract import Contract, ContractStatus
from app.models.notification import NotificationType
from app.models.user import User, UserRole
from app.models.wallet import WalletTransaction, WalletTransactionStatus, WalletTransactionType
from app.schemas.contract import ContractOut, ContractUpdate
from app.services.notify import notify
from app.services.reminders import check_contract_reminder, check_contract_escalation, CONTRACT_REMINDER_AFTER

router = APIRouter(tags=["contracts"])


def _to_out(contract: Contract) -> ContractOut:
    out = ContractOut.model_validate(contract)
    out.project_title = contract.project.title if contract.project else None
    return out


def _authorize(contract: Contract, user: User) -> str:
    if user.id == contract.client_id:
        return "client"
    if user.id == contract.professional_id:
        return "professional"
    if user.role == UserRole.admin:
        return "admin"
    raise HTTPException(status_code=403, detail="Not authorized to view this contract")


@router.get("/projects/{project_id}/contract", response_model=ContractOut)
def get_project_contract(project_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    contract = db.query(Contract).filter(Contract.project_id == project_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="No contract has been generated for this project yet")
    _authorize(contract, current_user)
    check_contract_reminder(db, contract)
    check_contract_escalation(db, contract)
    return _to_out(contract)


@router.get("/contracts/{contract_id}/history")
def get_contract_history(contract_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    contract = db.get(Contract, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    _authorize(contract, current_user)
    return contract.history or []


@router.patch("/contracts/{contract_id}", response_model=ContractOut)
def edit_contract(
    contract_id: str,
    payload: ContractUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Either the client or the professional can edit the scope of work —
    the talent often understands the trade better than the client, so this
    isn't client-only. Any edit resets both approvals: the new content has
    to be reviewed and approved again by both sides."""
    contract = db.get(Contract, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    role = _authorize(contract, current_user)
    if role == "admin":
        raise HTTPException(status_code=403, detail="Only the client or professional can edit this contract")
    if contract.status == ContractStatus.approved:
        raise HTTPException(status_code=400, detail="This contract is already approved and locked")

    history = list(contract.history or [])
    history.append({
        "version": contract.version,
        "content": contract.content,
        "edited_by": contract.last_edited_by,
        "edited_at": contract.updated_at.isoformat() if contract.updated_at else None,
    })
    contract.history = history

    contract.content = payload.content
    contract.last_edited_by = role
    contract.client_approved = False
    contract.professional_approved = False
    contract.version += 1
    contract.status = "sent_to_professional" if role == "client" else "sent_to_client"
    contract.updated_at = datetime.utcnow()
    contract.approval_reminder_sent = False
    contract.admin_escalated_at = None

    other_id = contract.professional_id if role == "client" else contract.client_id
    other_label = "client" if role == "professional" else "professional"
    notify(
        db, other_id, NotificationType.general,
        f"Contract updated for \"{contract.project.title}\"",
        body=f"The {('client' if role == 'client' else 'talent')} edited the scope of work — please review and approve.",
        link=f"/{'talent' if role == 'client' else 'client'}/dashboard/find-work/{contract.project_id}" if role == "client" else f"/client/dashboard/projects/{contract.project_id}",
        email_also=True,
    )
    db.commit()
    db.refresh(contract)
    return _to_out(contract)


@router.get("/admin/contracts")
def admin_list_contracts(current_user: User = Depends(require_role(UserRole.admin)), db: Session = Depends(get_db)):
    """Ops/support visibility into every contract's approval + acceptance-fee
    status, so a stalled negotiation (neither side has approved in a while)
    can be spotted and nudged without digging through individual projects."""
    from datetime import datetime as _dt

    contracts = db.query(Contract).order_by(Contract.updated_at.desc()).all()
    now = _dt.utcnow()
    rows = []
    for c in contracts:
        fee_paid = (
            db.query(WalletTransaction)
            .filter(
                WalletTransaction.project_id == c.project_id,
                WalletTransaction.professional_id == c.professional_id,
                WalletTransaction.type == WalletTransactionType.acceptance_fee,
                WalletTransaction.status == WalletTransactionStatus.successful,
            )
            .first()
            is not None
        )
        stalled = c.status not in (ContractStatus.approved, ContractStatus.draft) and (now - c.updated_at) > CONTRACT_REMINDER_AFTER
        rows.append({
            "id": c.id,
            "project_id": c.project_id,
            "project_title": c.project.title if c.project else None,
            "client_id": c.client_id,
            "client_name": f"{c.client.first_name} {c.client.last_name}" if c.client else None,
            "professional_id": c.professional_id,
            "professional_name": f"{c.professional.first_name} {c.professional.last_name}" if c.professional else None,
            "status": c.status,
            "client_approved": c.client_approved,
            "professional_approved": c.professional_approved,
            "version": c.version,
            "updated_at": c.updated_at,
            "approved_at": c.approved_at,
            "acceptance_fee_paid": fee_paid,
            "stalled": stalled,
            "escalated": c.admin_escalated_at is not None,
        })
    return rows


@router.post("/admin/contracts/{contract_id}/nudge")
def admin_nudge_contract(contract_id: str, current_user: User = Depends(require_role(UserRole.admin)), db: Session = Depends(get_db)):
    """Manually re-notify whoever hasn't approved yet — for a contract an
    admin has flagged as stalled and wants to give a nudge outside the
    normal once-per-state automatic reminder."""
    contract = db.get(Contract, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    if contract.status == ContractStatus.approved:
        raise HTTPException(status_code=400, detail="This contract is already approved")

    pending = []
    if not contract.client_approved:
        pending.append((contract.client_id, f"/client/dashboard/projects/{contract.project_id}"))
    if not contract.professional_approved:
        pending.append((contract.professional_id, f"/talent/dashboard/find-work/{contract.project_id}"))
    for user_id, link in pending:
        notify(
            db, user_id, NotificationType.general,
            f"Reminder: contract needs your approval — \"{contract.project.title}\"",
            body="Our support team noticed this contract has been waiting a while. Please review and approve so work can begin.",
            link=link, email_also=True,
        )
    contract.approval_reminder_sent = True
    contract.admin_escalated_at = None
    db.commit()
    return {"notified": len(pending)}


@router.post("/contracts/{contract_id}/send", response_model=ContractOut)
def send_contract_for_approval(
    contract_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Explicitly send the current draft to the other party for review —
    lets the talent draft/edit first (common when the client doesn't know
    the trade well) then hand it off for the client's approval, or vice
    versa."""
    contract = db.get(Contract, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    role = _authorize(contract, current_user)
    if role == "admin":
        raise HTTPException(status_code=403, detail="Only the client or professional can send this contract")
    if contract.status == ContractStatus.approved:
        raise HTTPException(status_code=400, detail="This contract is already approved")

    contract.status = "sent_to_professional" if role == "client" else "sent_to_client"
    contract.approval_reminder_sent = False
    contract.updated_at = datetime.utcnow()
    other_id = contract.professional_id if role == "client" else contract.client_id
    notify(
        db, other_id, NotificationType.general,
        f"Contract ready for your review — \"{contract.project.title}\"",
        body="Review the scope of work and approve or edit it.",
        link=f"/talent/dashboard/find-work/{contract.project_id}" if role == "client" else f"/client/dashboard/projects/{contract.project_id}",
        email_also=True,
    )
    db.commit()
    db.refresh(contract)
    return _to_out(contract)


@router.post("/contracts/{contract_id}/approve", response_model=ContractOut)
def approve_contract(
    contract_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    contract = db.get(Contract, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    role = _authorize(contract, current_user)
    if role == "admin":
        raise HTTPException(status_code=403, detail="Only the client or professional can approve this contract")

    if role == "client":
        contract.client_approved = True
    else:
        contract.professional_approved = True
    contract.approval_reminder_sent = False
    contract.admin_escalated_at = None
    contract.updated_at = datetime.utcnow()

    if contract.client_approved and contract.professional_approved:
        contract.status = ContractStatus.approved
        contract.approved_at = datetime.utcnow()
        notify(
            db, contract.professional_id, NotificationType.general,
            f"Contract approved for \"{contract.project.title}\"",
            body="Both sides have approved the contract. Once the acceptance fee (if any) is paid, work can begin.",
            link=f"/talent/dashboard/find-work/{contract.project_id}", email_also=True,
        )
        notify(
            db, contract.client_id, NotificationType.general,
            f"Contract approved for \"{contract.project.title}\"",
            body="Both sides have approved the contract.",
            link=f"/client/dashboard/projects/{contract.project_id}", email_also=True,
        )
    else:
        other_id = contract.professional_id if role == "client" else contract.client_id
        notify(
            db, other_id, NotificationType.general,
            f"Contract approved by the {'client' if role == 'client' else 'talent'} — \"{contract.project.title}\"",
            body="Your approval is still needed to finalize the contract.",
            link=f"/talent/dashboard/find-work/{contract.project_id}" if role == "client" else f"/client/dashboard/projects/{contract.project_id}",
            email_also=True,
        )

    db.commit()
    db.refresh(contract)
    return _to_out(contract)
