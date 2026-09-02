from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role
from app.core.config import settings
from app.db.session import get_db
from app.models.bid import Bid, BidStatus
from app.models.contract import Contract, ContractStatus
from app.models.profile import ProfessionalProfile
from app.models.project import Project, ProjectStatus
from app.models.user import KycStatus, User, UserRole
from app.models.notification import NotificationType
from app.schemas.bid import BidCreate, BidOut, BidUpdate, OfferRespond
from app.services.contracts import generate_contract_content
from app.services.notify import notify
from app.services.tiers import (
    count_active_projects,
    count_proposals_today,
    get_concurrent_project_limit,
    get_daily_proposal_limit,
    get_tier,
)

router = APIRouter(tags=["bids"])

def _to_out(bid: Bid, db: Session, viewer: Optional[User] = None) -> BidOut:
    out = BidOut.model_validate(bid)
    out.project_title = bid.project.title if bid.project else None
    out.professional_name = f"{bid.professional.first_name} {bid.professional.last_name}" if bid.professional else None
    profile = db.query(ProfessionalProfile).filter(ProfessionalProfile.user_id == bid.professional_id).first()
    if profile:
        out.professional_profile_id = profile.id
        out.professional_verification_status = profile.verification_status

        if viewer is None or viewer.role != UserRole.client:
            out.professional_tier = get_tier(bid.professional, profile)
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
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Proposal amount must be greater than zero")
    existing = (
        db.query(Bid)
        .filter(Bid.project_id == project_id, Bid.professional_id == current_user.id)
        .first()
    )
    if existing and existing.status != BidStatus.withdrawn:
        raise HTTPException(status_code=409, detail="You already submitted a proposal for this project")
    if existing:

        db.delete(existing)
        db.flush()

    profile = db.query(ProfessionalProfile).filter(ProfessionalProfile.user_id == current_user.id).first()
    tier = get_tier(current_user, profile)

    daily_limit = get_daily_proposal_limit(db, tier)
    if daily_limit is not None:
        sent_today = count_proposals_today(db, current_user.id)
        if sent_today >= daily_limit:
            raise HTTPException(
                status_code=429,
                detail=(
                    f"You've reached your Tier {tier} limit of {daily_limit} proposal"
                    f"{'s' if daily_limit != 1 else ''} per day. "
                    + ("Verify your identity (NIN) to unlock a higher tier." if tier == 1 else "Try again tomorrow, or upgrade your tier.")
                ),
            )

    concurrent_limit = get_concurrent_project_limit(db, tier)
    if concurrent_limit is not None:
        active_count = count_active_projects(db, current_user.id)
        if active_count >= concurrent_limit:
            raise HTTPException(
                status_code=429,
                detail=(
                    f"You're already working on {active_count} active project"
                    f"{'s' if active_count != 1 else ''}, the max for Tier {tier}. "
                    "Complete or hand off a project, or upgrade your tier, before taking on more."
                ),
            )

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
    return _to_out(bid, db, current_user)

@router.get("/projects/{project_id}/bids", response_model=list[BidOut])
def list_project_bids(project_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.client_id != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Not authorized to view these proposals")
    return [_to_out(b, db, current_user) for b in project.bids]

@router.get("/bids/mine", response_model=list[BidOut])
def my_bids(current_user: User = Depends(require_role(UserRole.professional)), db: Session = Depends(get_db)):
    bids = db.query(Bid).filter(Bid.professional_id == current_user.id).order_by(Bid.created_at.desc()).all()
    return [_to_out(b, db, current_user) for b in bids]

def _finalize_acceptance(db: Session, bid: Bid, project: Project, final_amount: float | None = None):
    """Shared by a direct accept and a confirmed offer: lock in the hire,
    reject the rest, notify the professional. `final_amount` overrides the
    bid's original amount if an offer changed it."""
    if project.assigned_professional_id and project.assigned_professional_id != bid.professional_id:

        raise HTTPException(status_code=400, detail="This project already has an accepted proposal")
    if final_amount is not None:
        bid.amount = final_amount
    bid.status = BidStatus.accepted
    project.status = ProjectStatus.in_progress
    project.assigned_professional_id = bid.professional_id
    for other in project.bids:
        if other.id != bid.id and other.status in (BidStatus.pending, BidStatus.shortlisted, BidStatus.offered):
            other.status = BidStatus.rejected
    notify(
        db, bid.professional_id, NotificationType.bid_accepted,
        f"Your proposal for \"{project.title}\" was accepted",
        body=f"Agreed amount: ₦{bid.amount:,.2f}. A contract has been generated for review before work begins.",
        link=f"/talent/dashboard/find-work/{project.id}", email_also=True,
    )
    _create_contract_if_missing(db, project, bid)

def _create_contract_if_missing(db: Session, project: Project, bid: Bid) -> None:
    """Auto-generate the scope-of-work contract the moment a bid is
    accepted — sits between acceptance and job commencement (see
    app/models/contract.py / app/services/contracts.py)."""
    existing = db.query(Contract).filter(Contract.project_id == project.id).first()
    if existing:
        return
    contract = Contract(
        project_id=project.id,
        bid_id=bid.id,
        client_id=project.client_id,
        professional_id=bid.professional_id,
        content=generate_contract_content(project, bid),
        status=ContractStatus.sent_to_client,
    )
    db.add(contract)

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
    if payload.status == BidStatus.accepted:
        if payload.offered_amount is not None and round(payload.offered_amount, 2) != round(bid.amount, 2):

            if payload.offered_amount <= 0:
                raise HTTPException(status_code=400, detail="Offer amount must be greater than zero")
            bid.status = BidStatus.offered
            bid.offered_amount = payload.offered_amount
            bid.offer_note = payload.offer_note
            notify(
                db, bid.professional_id, NotificationType.general,
                f"New offer for \"{project.title}\"",
                body=f"The client offered ₦{payload.offered_amount:,.2f} (your proposal was ₦{bid.amount:,.2f}). Review and confirm to accept.",
                link=f"/talent/dashboard/find-work/{project.id}", email_also=True,
            )
            db.commit()
            db.refresh(bid)
            return _to_out(bid, db, current_user)
        _finalize_acceptance(db, bid, project)
    elif payload.status == BidStatus.shortlisted:
        bid.status = payload.status
        notify(
            db, bid.professional_id, NotificationType.bid_shortlisted,
            f"You've been shortlisted for \"{project.title}\"",
            body="The client shortlisted your proposal — keep an eye out for next steps.",
            link=f"/talent/dashboard/find-work/{project.id}", email_also=True,
        )
    elif payload.status == BidStatus.rejected:
        bid.status = payload.status
        notify(
            db, bid.professional_id, NotificationType.bid_rejected,
            f"Your proposal for \"{project.title}\" was not selected",
            link="/talent/dashboard/proposals", email_also=False,
        )
    else:
        bid.status = payload.status
    db.commit()
    db.refresh(bid)
    return _to_out(bid, db, current_user)

@router.post("/bids/{bid_id}/confirm-offer", response_model=BidOut)
def confirm_offer(
    bid_id: str,
    payload: OfferRespond,
    current_user: User = Depends(require_role(UserRole.professional)),
    db: Session = Depends(get_db),
):
    """The professional accepts the client's revised offer, finalizing the
    hire at the offered amount."""
    bid = db.get(Bid, bid_id)
    if not bid:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if bid.professional_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if bid.status != BidStatus.offered or bid.offered_amount is None:
        raise HTTPException(status_code=400, detail="There's no pending offer on this proposal")
    project = bid.project
    _finalize_acceptance(db, bid, project, final_amount=bid.offered_amount)
    db.commit()
    db.refresh(bid)
    return _to_out(bid, db, current_user)

@router.post("/bids/{bid_id}/decline-offer", response_model=BidOut)
def decline_offer(
    bid_id: str,
    payload: OfferRespond,
    current_user: User = Depends(require_role(UserRole.professional)),
    db: Session = Depends(get_db),
):
    """The professional declines the client's revised offer — falls back to
    shortlisted rather than rejected, so the client can renegotiate or just
    accept the original amount instead."""
    bid = db.get(Bid, bid_id)
    if not bid:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if bid.professional_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if bid.status != BidStatus.offered:
        raise HTTPException(status_code=400, detail="There's no pending offer on this proposal")
    bid.status = BidStatus.shortlisted
    bid.offered_amount = None
    project = bid.project
    notify(
        db, project.client_id, NotificationType.general,
        f"Offer declined for \"{project.title}\"",
        body=(payload.note or f"{current_user.first_name} declined your offer.")[:200],
        link=f"/client/dashboard/projects/{project.id}", email_also=True,
    )
    db.commit()
    db.refresh(bid)
    return _to_out(bid, db, current_user)

@router.delete("/bids/{bid_id}", response_model=BidOut)
def withdraw_bid(
    bid_id: str,
    current_user: User = Depends(require_role(UserRole.professional)),
    db: Session = Depends(get_db),
):
    """Let a professional withdraw their own proposal while it's still being
    considered (pending or shortlisted). Once a client has accepted or
    rejected it, the status is terminal."""
    bid = db.get(Bid, bid_id)
    if not bid:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if bid.professional_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only withdraw your own proposals")
    if bid.status not in (BidStatus.pending, BidStatus.shortlisted):
        raise HTTPException(
            status_code=400,
            detail=f"A {bid.status.value} proposal can't be withdrawn",
        )
    bid.status = BidStatus.withdrawn
    db.commit()
    db.refresh(bid)
    return _to_out(bid, db, current_user)
