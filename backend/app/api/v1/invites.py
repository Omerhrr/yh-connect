from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_client_kyc_verified, require_role
from app.db.session import get_db
from app.models.bid import Bid, BidStatus
from app.models.project import Project, ProjectStatus
from app.models.project_invite import InviteStatus, ProjectInvite
from app.models.user import User, UserRole
from app.models.notification import NotificationType
from app.schemas.invite import InviteCreate, InviteOut, InviteUpdate
from app.services.notify import notify

router = APIRouter(tags=["invites"])


def _to_out(invite: ProjectInvite) -> InviteOut:
    out = InviteOut.model_validate(invite)
    out.project_title = invite.project.title if invite.project else None
    out.professional_name = f"{invite.professional.first_name} {invite.professional.last_name}" if invite.professional else None
    out.client_name = f"{invite.client.first_name} {invite.client.last_name}" if invite.client else None
    return out


@router.post("/projects/{project_id}/invite", response_model=InviteOut, status_code=201)
def invite_professional(
    project_id: str,
    payload: InviteCreate,
    current_user: User = Depends(require_client_kyc_verified),
    db: Session = Depends(get_db),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to invite for this project")
    if project.status != ProjectStatus.open:
        raise HTTPException(status_code=400, detail="This project is no longer accepting proposals")
    existing = (
        db.query(ProjectInvite)
        .filter(
            ProjectInvite.project_id == project_id,
            ProjectInvite.professional_id == payload.professional_id,
            ProjectInvite.status == InviteStatus.pending,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="This professional already has a pending invite for this project")
    invite = ProjectInvite(
        project_id=project_id,
        professional_id=payload.professional_id,
        client_id=current_user.id,
        proposed_amount=payload.proposed_amount,
        message=payload.message,
    )
    db.add(invite)
    db.flush()
    notify(
        db, invite.professional_id, NotificationType.invite_received,
        f"You've been invited to \"{project.title}\"",
        body=f"{current_user.first_name} {current_user.last_name} invited you to submit a proposal.",
        link="/talent/dashboard/proposals", email_also=True,
    )
    db.commit()
    db.refresh(invite)
    return _to_out(invite)


@router.get("/projects/{project_id}/invites", response_model=list[InviteOut])
def list_project_invites(project_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.client_id != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Not authorized to view these invites")
    invites = db.query(ProjectInvite).filter(ProjectInvite.project_id == project_id).order_by(ProjectInvite.created_at.desc()).all()
    return [_to_out(i) for i in invites]


@router.get("/invites/mine", response_model=list[InviteOut])
def my_invites(current_user: User = Depends(require_role(UserRole.professional)), db: Session = Depends(get_db)):
    invites = (
        db.query(ProjectInvite)
        .filter(ProjectInvite.professional_id == current_user.id)
        .order_by(ProjectInvite.created_at.desc())
        .all()
    )
    return [_to_out(i) for i in invites]


@router.patch("/invites/{invite_id}", response_model=InviteOut)
def respond_to_invite(
    invite_id: str,
    payload: InviteUpdate,
    current_user: User = Depends(require_role(UserRole.professional)),
    db: Session = Depends(get_db),
):
    invite = db.get(ProjectInvite, invite_id)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite.professional_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to respond to this invite")
    if invite.status != InviteStatus.pending:
        raise HTTPException(status_code=400, detail="This invite has already been responded to")

    invite.status = payload.status

    if payload.status == InviteStatus.accepted:
        project = invite.project
        if project.status != ProjectStatus.open:
            raise HTTPException(status_code=400, detail="This project is no longer accepting proposals")
        existing_bid = (
            db.query(Bid)
            .filter(Bid.project_id == project.id, Bid.professional_id == current_user.id)
            .first()
        )
        if not existing_bid:
            bid = Bid(
                project_id=project.id,
                professional_id=current_user.id,
                amount=invite.proposed_amount if invite.proposed_amount is not None else project.budget_min,
                cover_letter=invite.message,
                status=BidStatus.pending,
            )
            db.add(bid)

    db.commit()
    db.refresh(invite)
    return _to_out(invite)
