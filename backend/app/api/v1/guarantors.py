"""Guarantors (stakeholder feedback F15): a professional can name another
registered platform user to vouch for the quality of their work. The
guarantor must already be on the platform and must accept the request."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role
from app.db.session import get_db
from app.models.guarantor import Guarantor
from app.models.notification import NotificationType
from app.models.profile import ProfessionalProfile
from app.models.user import User, UserRole
from app.services.notify import notify
from app.services.platform_settings import is_feature_enabled

router = APIRouter(tags=["guarantors"])

MAX_ACTIVE_GUARANTORS = 3


def _require_enabled(db: Session):
    if not is_feature_enabled(db, "feature_guarantors_enabled"):
        raise HTTPException(status_code=403, detail="Guarantors aren't enabled on this platform yet")


class GuarantorRequest(BaseModel):
    email: str
    message: str | None = None


class GuarantorOut(BaseModel):
    id: str
    status: str
    message: str | None = None
    created_at: datetime
    responded_at: datetime | None = None
    professional_id: str
    professional_name: str | None = None
    guarantor_id: str
    guarantor_name: str | None = None


def _name(u: User | None) -> str | None:
    return f"{u.first_name} {u.last_name}".strip() if u else None


def _out(g: Guarantor) -> GuarantorOut:
    return GuarantorOut(
        id=g.id, status=g.status, message=g.message, created_at=g.created_at,
        responded_at=g.responded_at,
        professional_id=g.professional_id, professional_name=_name(g.professional),
        guarantor_id=g.guarantor_id, guarantor_name=_name(g.guarantor),
    )


@router.post("/guarantors", response_model=GuarantorOut, status_code=201)
def request_guarantor(
    payload: GuarantorRequest,
    current_user: User = Depends(require_role(UserRole.professional)),
    db: Session = Depends(get_db),
):
    _require_enabled(db)
    email = payload.email.strip().lower()
    target =db.query(User).filter(User.email == email).first()
    if not target:
        raise HTTPException(
            status_code=404,
            detail="No one with that email is on YH Connect. A guarantor has to have an account on the platform first.",
        )
    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="You can't be your own guarantor")
    if not target.is_active:
        raise HTTPException(status_code=400, detail="That account isn't active")

    existing = (
        db.query(Guarantor)
        .filter(Guarantor.professional_id == current_user.id, Guarantor.guarantor_id == target.id)
        .first()
    )
    active = (
        db.query(Guarantor)
        .filter(Guarantor.professional_id == current_user.id, Guarantor.status.in_(["pending", "accepted"]))
        .count()
    )
    if existing and existing.status in ("pending", "accepted"):
        raise HTTPException(status_code=400, detail="You already have this person as a guarantor")
    if active >= MAX_ACTIVE_GUARANTORS:
        raise HTTPException(status_code=400, detail=f"You can have up to {MAX_ACTIVE_GUARANTORS} guarantors")

    if existing:  # previously declined/revoked: reuse the row
        existing.status = "pending"
        existing.message = payload.message
        existing.responded_at = None
        existing.created_at = datetime.utcnow()
        g = existing
    else:
        g = Guarantor(professional_id=current_user.id, guarantor_id=target.id, message=payload.message)
        db.add(g)
    db.flush()

    link = "/talent/dashboard/settings" if target.role == UserRole.professional else "/client/dashboard/settings"
    notify(
        db, target.id, NotificationType.general,
        f"{current_user.first_name} {current_user.last_name} asked you to be their guarantor",
        body="Open your settings to accept or decline. A guarantor vouches for the quality of their work.",
        link=link, email_also=True,
    )
    db.commit()
    db.refresh(g)
    return _out(g)


@router.get("/guarantors/mine", response_model=list[GuarantorOut])
def my_guarantors(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not is_feature_enabled(db, "feature_guarantors_enabled"):
        return []
    rows = (
        db.query(Guarantor)
        .filter(Guarantor.professional_id == current_user.id)
        .order_by(Guarantor.created_at.desc())
        .all()
    )
    return [_out(g) for g in rows]


@router.get("/guarantors/requests", response_model=list[GuarantorOut])
def guarantor_requests(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Requests other people have sent asking *me* to guarantee them."""
    if not is_feature_enabled(db, "feature_guarantors_enabled"):
        return []
    rows = (
        db.query(Guarantor)
        .filter(Guarantor.guarantor_id == current_user.id, Guarantor.status.in_(["pending", "accepted"]))
        .order_by(Guarantor.created_at.desc())
        .all()
    )
    return [_out(g) for g in rows]


@router.post("/guarantors/{guarantor_row_id}/respond", response_model=GuarantorOut)
def respond(
    guarantor_row_id: str,
    accept: bool,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_enabled(db)
    g = db.get(Guarantor, guarantor_row_id)
    if not g or g.guarantor_id != current_user.id:
        raise HTTPException(status_code=404, detail="Request not found")
    if g.status != "pending":
        raise HTTPException(status_code=400, detail=f"This request is already {g.status}")
    g.status = "accepted" if accept else "declined"
    g.responded_at = datetime.utcnow()
    notify(
        db, g.professional_id, NotificationType.general,
        f"{current_user.first_name} {'accepted' if accept else 'declined'} your guarantor request",
        link="/talent/dashboard/settings", email_also=True,
    )
    db.commit()
    db.refresh(g)
    return _out(g)


@router.delete("/guarantors/{guarantor_row_id}", response_model=GuarantorOut)
def revoke(guarantor_row_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Either side can end the arrangement."""
    g = db.get(Guarantor, guarantor_row_id)
    if not g or current_user.id not in (g.professional_id, g.guarantor_id):
        raise HTTPException(status_code=404, detail="Not found")
    g.status = "revoked"
    g.responded_at = datetime.utcnow()
    db.commit()
    db.refresh(g)
    return _out(g)


@router.get("/professionals/{profile_id}/guarantors")
def public_guarantors(profile_id: str, db: Session = Depends(get_db)):
    """Accepted guarantors shown publicly on a professional's profile."""
    if not is_feature_enabled(db, "feature_guarantors_enabled"):
        return []
    profile = db.get(ProfessionalProfile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    rows = (
        db.query(Guarantor)
        .filter(Guarantor.professional_id == profile.user_id, Guarantor.status == "accepted")
        .all()
    )
    return [{"id": g.id, "name": _name(g.guarantor)} for g in rows]
