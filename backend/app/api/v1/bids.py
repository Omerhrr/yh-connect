from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role
from app.core.config import settings
from app.db.session import get_db
from app.models.bid import Bid, BidStatus
from app.models.profile import ProfessionalProfile
from app.models.project import Project, ProjectStatus
from app.models.user import KycStatus, User, UserRole
from app.models.notification import NotificationType
from app.schemas.bid import BidCreate, BidOut, BidUpdate
from app.services.notify import notify

router = APIRouter(tags=["bids"])


def _to_out(bid: Bid, db: Session) -> BidOut:
    out = BidOut.model_validate(bid)
    out.project_title = bid.project.title if bid.project else None
    out.professional_name = f"{bid.professional.first_name} {bid.professional.last_name}" if bid.professional else None
    profile = db.query(ProfessionalProfile).filter(ProfessionalProfile.user_id == bid.professional_id).first()
    if profile:
        out.professional_verification_status = profile.verification_status
        out.professional_rating = profile.rating
        out.professional_review_count = profile.review_count
        out.professional_portfolio_count = len(profile.portfolio_items)
        out.professional_hourly_rate = profile.hourly_rate
    return out


@router.post("/projects/{project_id}/bids", response_model=BidOut, status_code=201)
def create_bid(
    project_id: str,
    payload: BidCreate,
    current_user: User = Depends(require_role(UserRole.professional)),
    db: Session = Depends(get_db),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.status != ProjectStatus.open:
        raise HTTPException(status_code=400, detail="This project is no longer accepting proposals")
    existing = (
        db.query(Bid)
        .filter(Bid.project_id == project_id, Bid.professional_id == current_user.id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="You already submitted a proposal for this project")
    bid = Bid(
        project_id=project_id,
        professional_id=current_user.id,
        amount=payload.amount,
        cover_letter=payload.cover_letter,
        estimated_days=payload.estimated_days,
    )
    db.add(bid)
    db.flush()
    notify(
        db,
        project.client_id,
        NotificationType.bid_received,
        f"New proposal on \"{project.title}\"",
        body=f"{current_user.first_name} {current_user.last_name} submitted a proposal.",
        link=f"/client/dashboard/projects/{project.id}",
        email_also=True,
    )
    db.commit()
    db.refresh(bid)
    return _to_out(bid, db)


@router.get("/projects/{project_id}/bids", response_model=list[BidOut])
def list_project_bids(project_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.client_id != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Not authorized to view these proposals")
    return [_to_out(b, db) for b in project.bids]


@router.get("/bids/mine", response_model=list[BidOut])
def my_bids(current_user: User = Depends(require_role(UserRole.professional)), db: Session = Depends(get_db)):
    bids = db.query(Bid).filter(Bid.professional_id == current_user.id).order_by(Bid.created_at.desc()).all()
    return [_to_out(b, db) for b in bids]


@router.patch("/bids/{bid_id}", response_model=BidOut)
def update_bid(bid_id: str, payload: BidUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    bid = db.get(Bid, bid_id)
    if not bid:
        raise HTTPException(status_code=404, detail="Proposal not found")
    project = bid.project
    if project.client_id != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Not authorized to update this proposal")
    if (
        settings.KYC_ENFORCEMENT_ENABLED
        and payload.status == BidStatus.accepted
        and current_user.role == UserRole.client
        and current_user.kyc_status != KycStatus.verified
    ):
        raise HTTPException(
            status_code=403,
            detail="Please verify your identity (NIN) before accepting a proposal.",
        )
    bid.status = payload.status
    if payload.status == BidStatus.accepted:
        project.status = ProjectStatus.in_progress
        project.assigned_professional_id = bid.professional_id
        for other in project.bids:
            if other.id != bid.id and other.status in (BidStatus.pending, BidStatus.shortlisted):
                other.status = BidStatus.rejected
        notify(
            db, bid.professional_id, NotificationType.bid_accepted,
            f"Your proposal for \"{project.title}\" was accepted",
            body="You can now set up milestones and get started.",
            link=f"/talent/dashboard/find-work/{project.id}", email_also=True,
        )
    elif payload.status == BidStatus.rejected:
        notify(
            db, bid.professional_id, NotificationType.bid_rejected,
            f"Your proposal for \"{project.title}\" was not selected",
            link="/talent/dashboard/proposals", email_also=False,
        )
    db.commit()
    db.refresh(bid)
    return _to_out(bid, db)
