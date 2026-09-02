from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.contract import Contract, ContractStatus
from app.models.notification import NotificationType
from app.models.user import User, UserRole
from app.schemas.contract import ContractOut, ContractUpdate
from app.services.notify import notify

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
    return _to_out(contract)


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

    contract.content = payload.content
    contract.last_edited_by = role
    contract.client_approved = False
    contract.professional_approved = False
    contract.version += 1
    contract.status = "sent_to_professional" if role == "client" else "sent_to_client"
    contract.updated_at = datetime.utcnow()

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
