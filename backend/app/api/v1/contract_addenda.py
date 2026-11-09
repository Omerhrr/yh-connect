"""Contract addenda (stakeholder feedback F10/F11): amendments and
out-of-scope work on an approved *flexible* contract are handled as separate,
separately-approved mini-contracts. The original contract is never edited,
so there is always a clean record of what was initially agreed."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.contract import Contract, ContractStatus
from app.models.contract_addendum import ContractAddendum
from app.models.milestone import Milestone
from app.models.notification import NotificationType
from app.models.project import Project, ProjectStatus
from app.models.user import User
from app.services.notify import notify
from app.services.project_log import post_system_message

router = APIRouter(tags=["contract-addenda"])


class AddendumCreate(BaseModel):
    title: str
    content: str
    amount_delta: float = 0.0


class AddendumOut(BaseModel):
    id: str
    contract_id: str
    project_id: str
    proposed_by: str
    title: str
    content: str
    amount_delta: float
    status: str
    client_approved: bool
    professional_approved: bool
    resulting_milestone_id: str | None = None
    created_at: datetime
    approved_at: datetime | None = None

    class Config:
        from_attributes = True


def _party_role(contract: Contract, user: User) -> str:
    if user.id == contract.client_id:
        return "client"
    if user.id == contract.professional_id:
        return "professional"
    raise HTTPException(status_code=403, detail="Not authorized for this contract")


def _link_for(role_of_recipient: str, project_id: str) -> str:
    return (
        f"/client/dashboard/projects/{project_id}"
        if role_of_recipient == "client"
        else f"/talent/dashboard/find-work/{project_id}"
    )


@router.get("/projects/{project_id}/contract/addenda", response_model=list[AddendumOut])
def list_addenda(project_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    contract = db.query(Contract).filter(Contract.project_id == project_id).first()
    if not contract:
        return []
    _party_role(contract, current_user)
    return (
        db.query(ContractAddendum)
        .filter(ContractAddendum.contract_id == contract.id)
        .order_by(ContractAddendum.created_at.asc())
        .all()
    )


@router.post("/projects/{project_id}/contract/addenda", response_model=AddendumOut, status_code=201)
def create_addendum(
    project_id: str,
    payload: AddendumCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    contract = db.query(Contract).filter(Contract.project_id == project_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="No contract for this project")
    role = _party_role(contract, current_user)
    if contract.status != ContractStatus.approved:
        raise HTTPException(status_code=400, detail="Only an approved contract can be amended")
    if contract.contract_type != "flexible":
        raise HTTPException(
            status_code=400,
            detail="This is a fixed contract and can't be amended. Agree a new contract for additional work.",
        )
    project = contract.project
    if project.status in (ProjectStatus.completed, ProjectStatus.cancelled):
        raise HTTPException(status_code=400, detail="This project is closed")
    if not payload.title.strip() or not payload.content.strip():
        raise HTTPException(status_code=400, detail="Please give the addendum a title and describe the change")

    addendum = ContractAddendum(
        contract_id=contract.id,
        project_id=project_id,
        proposed_by=current_user.id,
        title=payload.title.strip(),
        content=payload.content.strip(),
        amount_delta=payload.amount_delta,
        client_approved=(role == "client"),
        professional_approved=(role == "professional"),
    )
    db.add(addendum)
    db.flush()

    other_role = "professional" if role == "client" else "client"
    other_id = contract.professional_id if role == "client" else contract.client_id
    notify(
        db, other_id, NotificationType.general,
        f"Contract addendum proposed — \"{project.title}\"",
        body=f"{addendum.title}" + (f" (₦{addendum.amount_delta:+,.2f})" if addendum.amount_delta else ""),
        link=_link_for(other_role, project_id),
        email_also=True,
    )
    post_system_message(db, project, current_user.id, f"📎 Contract addendum proposed: {addendum.title}")
    db.commit()
    db.refresh(addendum)
    return addendum


@router.post("/contract-addenda/{addendum_id}/approve", response_model=AddendumOut)
def approve_addendum(addendum_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    addendum = db.get(ContractAddendum, addendum_id)
    if not addendum:
        raise HTTPException(status_code=404, detail="Addendum not found")
    contract = db.get(Contract, addendum.contract_id)
    role = _party_role(contract, current_user)
    if addendum.status != "pending":
        raise HTTPException(status_code=400, detail=f"This addendum is already {addendum.status}")

    if role == "client":
        addendum.client_approved = True
    else:
        addendum.professional_approved = True

    project = contract.project
    if addendum.client_approved and addendum.professional_approved:
        addendum.status = "approved"
        addendum.approved_at = datetime.utcnow()
        # Extra paid work becomes its own milestone the client can fund.
        if addendum.amount_delta > 0:
            milestone = Milestone(
                project_id=addendum.project_id,
                created_by=contract.client_id,
                title=f"Addendum: {addendum.title}"[:120],
                description=addendum.content,
                amount=addendum.amount_delta,
                sort_order=len(project.milestones),
            )
            db.add(milestone)
            db.flush()
            addendum.resulting_milestone_id = milestone.id
        for uid, r in ((contract.client_id, "client"), (contract.professional_id, "professional")):
            notify(
                db, uid, NotificationType.general,
                f"Addendum approved — \"{project.title}\"",
                body=addendum.title,
                link=_link_for(r, addendum.project_id),
                email_also=True,
            )
        post_system_message(db, project, current_user.id, f"✅ Addendum approved by both sides: {addendum.title}")
    else:
        other_role = "professional" if role == "client" else "client"
        other_id = contract.professional_id if role == "client" else contract.client_id
        notify(
            db, other_id, NotificationType.general,
            f"Addendum awaiting your approval — \"{project.title}\"",
            body=addendum.title,
            link=_link_for(other_role, addendum.project_id),
            email_also=True,
        )
    db.commit()
    db.refresh(addendum)
    return addendum


@router.post("/contract-addenda/{addendum_id}/reject", response_model=AddendumOut)
def reject_addendum(addendum_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    addendum = db.get(ContractAddendum, addendum_id)
    if not addendum:
        raise HTTPException(status_code=404, detail="Addendum not found")
    contract = db.get(Contract, addendum.contract_id)
    role = _party_role(contract, current_user)
    if addendum.status != "pending":
        raise HTTPException(status_code=400, detail=f"This addendum is already {addendum.status}")
    addendum.status = "rejected"
    other_role = "professional" if role == "client" else "client"
    other_id = contract.professional_id if role == "client" else contract.client_id
    notify(
        db, other_id, NotificationType.general,
        f"Addendum declined — \"{contract.project.title}\"",
        body=addendum.title,
        link=_link_for(other_role, addendum.project_id),
        email_also=True,
    )
    db.commit()
    db.refresh(addendum)
    return addendum
