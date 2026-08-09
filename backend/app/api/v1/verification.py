from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.db.session import get_db
from app.models.profile import ProfessionalProfile
from app.models.user import User, UserRole
from app.models.notification import NotificationType
from app.schemas.verification import VerificationReview, VerificationSubmit
from app.services.notify import notify

router = APIRouter(tags=["verification"])


@router.post("/professionals/me/verification")
def submit_verification(
    payload: VerificationSubmit,
    current_user: User = Depends(require_role(UserRole.professional)),
    db: Session = Depends(get_db),
):
    profile = db.query(ProfessionalProfile).filter(ProfessionalProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    if payload.id_document_url:
        profile.id_document_url = payload.id_document_url
    if payload.license_document_url:
        profile.license_document_url = payload.license_document_url
    if payload.insurance_document_url:
        profile.insurance_document_url = payload.insurance_document_url
    profile.verification_status = "pending"
    db.commit()
    return {"verification_status": profile.verification_status}


@router.get("/admin/verifications")
def list_pending_verifications(
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    profiles = db.query(ProfessionalProfile).filter(ProfessionalProfile.verification_status == "pending").all()
    return [
        {
            "profile_id": p.id,
            "name": f"{p.user.first_name} {p.user.last_name}",
            "title": p.title,
            "id_document_url": p.id_document_url,
            "license_document_url": p.license_document_url,
            "insurance_document_url": p.insurance_document_url,
        }
        for p in profiles
    ]


@router.patch("/admin/verifications/{profile_id}")
def review_verification(
    profile_id: str,
    payload: VerificationReview,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    profile = db.get(ProfessionalProfile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    if payload.status not in ("verified", "rejected"):
        raise HTTPException(status_code=400, detail="status must be 'verified' or 'rejected'")
    profile.verification_status = payload.status
    profile.is_verified = payload.status == "verified"
    profile.verification_note = payload.note

    if payload.status == "verified":
        notify(
            db, profile.user_id, NotificationType.kyc_status_changed,
            "You're now a verified professional",
            body="Your documents were reviewed and approved. A verified badge now shows on your profile.",
            link="/talent/dashboard/settings", email_also=True,
        )
    else:
        notify(
            db, profile.user_id, NotificationType.kyc_status_changed,
            "Your verification was not approved",
            body=payload.note or "Please review and resubmit your documents.",
            link="/talent/dashboard/settings", email_also=True,
        )

    db.commit()
    return {"verification_status": profile.verification_status}
