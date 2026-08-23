from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.core.limiter import limiter
from app.db.session import get_db
from app.models.certification import Certification
from app.models.profile import ProfessionalProfile
from app.models.user import KycStatus, User, UserRole
from app.models.notification import NotificationType
from app.schemas.verification import (
    AddressVerificationReview,
    AddressVerificationSubmit,
    BusinessVerificationReview,
    BusinessVerificationSubmit,
    CertificationReview,
    VerificationReview,
    VerificationSubmit,
)
from app.schemas.user import KycOut, KycSubmit
from app.services.notify import notify
from app.services.nin_verification import NinVerificationError, nin_verification_client
from app.services.tiers import TIER_LABELS, get_tier

router = APIRouter(tags=["verification"])


def _my_profile(current_user: User, db: Session) -> ProfessionalProfile:
    profile = db.query(ProfessionalProfile).filter(ProfessionalProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


# ─── General verification bundle (id/license/insurance docs) ───────────────

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
            "user_id": p.user_id,
            "name": f"{p.user.first_name} {p.user.last_name}",
            "title": p.title,
            "email": p.user.email,
            "phone": p.user.phone,
            "category": p.category.label if p.category else None,
            "location": p.location,
            "bio": p.bio,
            "years_experience": p.years_experience,
            "license_number": p.license_number,
            "skills": p.skills_list,
            # For tier 2 review: the claimed NIN and the automated check's
            # outcome (if any), so the admin can cross-check the document.
            "nin": p.user.nin,
            "kyc_status": p.user.kyc_status,
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


# ─── Tier 2: NIN identity verification (professional-side) ─────────────────
# Same instant/automated flow as client KYC (app/api/v1/clients.py), just
# exposed to professionals too. Reaching tier 2 lifts the proposal/project
# caps a fresh tier 1 account starts with, see app/services/tiers.py.

@router.get("/professionals/me/kyc", response_model=KycOut)
def get_my_professional_kyc(current_user: User = Depends(require_role(UserRole.professional)), db: Session = Depends(get_db)):
    return KycOut(
        kyc_status=current_user.kyc_status,
        kyc_note=current_user.kyc_note,
        kyc_verified_at=current_user.kyc_verified_at,
    )


@router.post("/professionals/me/kyc", response_model=KycOut)
@limiter.limit("10/hour")
def submit_my_professional_kyc(
    request: Request,
    payload: KycSubmit,
    current_user: User = Depends(require_role(UserRole.professional)),
    db: Session = Depends(get_db),
):
    if current_user.kyc_status == KycStatus.verified:
        raise HTTPException(status_code=400, detail="Your identity is already verified")
    profile = _my_profile(current_user, db)
    if profile.verification_status == "verified":
        raise HTTPException(status_code=400, detail="Your identity is already verified")

    # Keep the submitted scan (NIN slip, national ID, voters card, passport)
    # on the profile either way, so an admin can review it if needed.
    if payload.document_url:
        profile.id_document_url = payload.document_url

    try:
        result = nin_verification_client.verify_nin(
            nin=payload.nin,
            first_name=current_user.first_name,
            last_name=current_user.last_name,
            dob=payload.dob,
        )
    except NinVerificationError as e:
        raise HTTPException(status_code=502, detail=f"Identity verification is temporarily unavailable: {e}")

    current_user.nin = payload.nin
    if result["verified"]:
        # Instant tier 2: the NIN matches, no admin needed. The uploaded
        # document (if any) stays on file for records.
        current_user.kyc_status = KycStatus.verified
        current_user.kyc_verified_at = datetime.utcnow()
        current_user.kyc_note = None
        notify(
            db, current_user.id, NotificationType.kyc_status_changed,
            "You're now Tier 2",
            body="Your identity (NIN) was verified. You can send up to the tier 2 daily proposal limit and take on more active projects.",
            link="/talent/dashboard/settings", email_also=True,
        )
    elif payload.document_url:
        # NIN check failed but a physical document was uploaded: hand it to
        # the admin for review. Approval grants tier 2 via
        # ProfessionalProfile.verification_status (see app/services/tiers.py).
        profile.verification_status = "pending"
        profile.verification_note = (
            "Your identity document was submitted for admin review. "
            f"The NIN check couldn't be confirmed automatically: {result['reason']}"
        )
        notify(
            db, current_user.id, NotificationType.kyc_status_changed,
            "Identity document under review",
            body="We couldn't confirm your NIN automatically, so your uploaded document is being reviewed by our team for your tier 2 upgrade.",
            link="/talent/dashboard/settings",
        )
    else:
        # No document to fall back on: record the failed automated check so
        # the professional sees the reason and can retry (or upload a doc).
        current_user.kyc_status = KycStatus.rejected
        current_user.kyc_note = result["reason"]

    db.commit()
    db.refresh(current_user)
    return KycOut(
        kyc_status=current_user.kyc_status,
        kyc_note=current_user.kyc_note,
        kyc_verified_at=current_user.kyc_verified_at,
    )


# ─── Tier 3: proof of address (admin-reviewed, not automated) ──────────────

@router.post("/professionals/me/address-verification")
def submit_address_verification(
    payload: AddressVerificationSubmit,
    current_user: User = Depends(require_role(UserRole.professional)),
    db: Session = Depends(get_db),
):
    if current_user.kyc_status != KycStatus.verified:
        raise HTTPException(status_code=400, detail="Verify your identity (NIN) first, that's tier 2 before tier 3.")
    profile = _my_profile(current_user, db)
    if profile.address_verification_status == "verified":
        raise HTTPException(status_code=400, detail="Your address is already verified")
    profile.address_document_url = payload.document_url
    profile.address_verification_status = "pending"
    profile.address_verification_note = None
    db.commit()
    return {"address_verification_status": profile.address_verification_status}


@router.get("/admin/address-verifications")
def list_pending_address_verifications(
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    profiles = db.query(ProfessionalProfile).filter(ProfessionalProfile.address_verification_status == "pending").all()
    return [
        {
            "profile_id": p.id,
            "user_id": p.user_id,
            "name": f"{p.user.first_name} {p.user.last_name}",
            "title": p.title,
            "email": p.user.email,
            "phone": p.user.phone,
            "category": p.category.label if p.category else None,
            "location": p.location,
            "bio": p.bio,
            # Address review only unlocks after tier 2 (NIN) is verified, so
            # this is always confirmed by the time it's here, useful context
            # for the admin to see it front and center rather than dig for it.
            "kyc_status": p.user.kyc_status,
            "address_document_url": p.address_document_url,
        }
        for p in profiles
    ]


@router.patch("/admin/address-verifications/{profile_id}")
def review_address_verification(
    profile_id: str,
    payload: AddressVerificationReview,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    profile = db.get(ProfessionalProfile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    if payload.status not in ("verified", "rejected"):
        raise HTTPException(status_code=400, detail="status must be 'verified' or 'rejected'")
    profile.address_verification_status = payload.status
    profile.address_verification_note = payload.note
    profile.address_verified_at = datetime.utcnow() if payload.status == "verified" else None
    db.commit()

    tier = get_tier(profile.user, profile)
    if payload.status == "verified":
        notify(
            db, profile.user_id, NotificationType.kyc_status_changed,
            f"You're now {TIER_LABELS[tier]}",
            body="Your proof of address was reviewed and approved. Tier 3 has no proposal or active-project caps.",
            link="/talent/dashboard/settings", email_also=True,
        )
    else:
        notify(
            db, profile.user_id, NotificationType.kyc_status_changed,
            "Your address verification was not approved",
            body=payload.note or "Please review and resubmit your document.",
            link="/talent/dashboard/settings", email_also=True,
        )
    return {"address_verification_status": profile.address_verification_status}


# ─── Badges: admin review of self-submitted certifications ─────────────────
# A certification only renders as a badge on the public profile once
# approved here, see ProfessionalOut.certifications / CertificationOut.

@router.get("/admin/certifications")
def list_pending_certifications(
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    certs = db.query(Certification).filter(Certification.verification_status == "pending").all()
    return [
        {
            "id": c.id,
            "profile_id": c.profile_id,
            "user_id": c.profile.user_id if c.profile else None,
            "name": c.name,
            "issuing_body": c.issuing_body,
            "credential_url": c.credential_url,
            "badge_name": c.badge_name,
            "professional_name": f"{c.profile.user.first_name} {c.profile.user.last_name}" if c.profile and c.profile.user else None,
            "professional_title": c.profile.title if c.profile else None,
            "category": c.profile.category.label if c.profile and c.profile.category else None,
            "email": c.profile.user.email if c.profile and c.profile.user else None,
            "issued_date": c.issued_date,
            "expiry_date": c.expiry_date,
            "submitted_at": c.created_at,
        }
        for c in certs
    ]


@router.patch("/admin/certifications/{certification_id}")
def review_certification(
    certification_id: str,
    payload: CertificationReview,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    cert = db.get(Certification, certification_id)
    if not cert:
        raise HTTPException(status_code=404, detail="Certification not found")
    if payload.status not in ("verified", "rejected"):
        raise HTTPException(status_code=400, detail="status must be 'verified' or 'rejected'")
    cert.verification_status = payload.status
    cert.verification_note = payload.note
    cert.verified_at = datetime.utcnow() if payload.status == "verified" else None
    if payload.status == "verified" and payload.badge_name:
        cert.badge_name = payload.badge_name.strip()
    db.commit()

    if payload.status == "verified":
        badge_label = cert.badge_name or cert.name
        notify(
            db, cert.profile.user_id, NotificationType.kyc_status_changed,
            f'"{badge_label}" badge approved',
            body="It now shows as a badge on your public profile.",
            link="/talent/dashboard/settings", email_also=True,
        )
    else:
        notify(
            db, cert.profile.user_id, NotificationType.kyc_status_changed,
            f'"{cert.name}" badge was not approved',
            body=payload.note or "Please review and resubmit.",
            link="/talent/dashboard/settings", email_also=True,
        )
    return {"verification_status": cert.verification_status}


# ─── Business verification (CAC): client-side, admin-reviewed ─────────────
# Distinct from is_verified_business itself — that flag only flips once an
# admin approves what's submitted here. Mirrors the certification/address
# review shape: submit -> pending -> admin approves/rejects -> badge shows.

@router.post("/clients/me/business-verification")
def submit_business_verification(
    payload: BusinessVerificationSubmit,
    current_user: User = Depends(require_role(UserRole.client)),
    db: Session = Depends(get_db),
):
    if current_user.business_verification_status == "verified":
        raise HTTPException(status_code=400, detail="Your business is already verified")
    if not payload.cac_number.strip() or not payload.cac_document_url.strip():
        raise HTTPException(status_code=400, detail="Provide both your CAC number and a document")
    current_user.cac_number = payload.cac_number.strip()
    current_user.cac_document_url = payload.cac_document_url.strip()
    current_user.business_verification_status = "pending"
    current_user.business_verification_note = None
    db.commit()
    return {"business_verification_status": current_user.business_verification_status}


@router.get("/admin/business-verifications")
def list_pending_business_verifications(
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    users = db.query(User).filter(User.business_verification_status == "pending").all()
    return [
        {
            "user_id": u.id,
            "name": f"{u.first_name} {u.last_name}",
            "email": u.email,
            "phone": u.phone,
            "company_name": u.company_name,
            "company_website": u.company_website,
            "cac_number": u.cac_number,
            "cac_document_url": u.cac_document_url,
        }
        for u in users
    ]


@router.patch("/admin/business-verifications/{user_id}")
def review_business_verification(
    user_id: str,
    payload: BusinessVerificationReview,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if payload.status not in ("verified", "rejected"):
        raise HTTPException(status_code=400, detail="status must be 'verified' or 'rejected'")
    user.business_verification_status = payload.status
    user.business_verification_note = payload.note
    user.business_verified_at = datetime.utcnow() if payload.status == "verified" else None
    user.is_verified_business = payload.status == "verified"
    db.commit()

    if payload.status == "verified":
        notify(
            db, user.id, NotificationType.general,
            "Your business is now verified",
            body="Your CAC documentation was reviewed and approved. The Verified Business badge now shows on your profile.",
            link="/client/dashboard/profile", email_also=True,
        )
    else:
        notify(
            db, user.id, NotificationType.general,
            "Your business verification was not approved",
            body=payload.note or "Please review and resubmit your CAC documentation.",
            link="/client/dashboard/profile", email_also=True,
        )
    return {"business_verification_status": user.business_verification_status}
