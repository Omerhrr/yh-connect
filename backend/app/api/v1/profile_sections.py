"""CRUD endpoints for the self-reported profile sections a professional
manages on their own profile: employment history, education, certifications.
Mirrors the portfolio.py pattern (add/delete only, owner-scoped)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.db.session import get_db
from app.models.certification import Certification
from app.models.education import Education
from app.models.employment import EmploymentHistory
from app.models.profile import ProfessionalProfile
from app.models.user import User, UserRole
from app.schemas.profile_extras import (
    EmploymentHistoryCreate, EmploymentHistoryOut,
    EducationCreate, EducationOut,
    CertificationCreate, CertificationOut,
)

router = APIRouter(prefix="/professionals/me", tags=["professionals"])


def _my_profile(current_user: User, db: Session) -> ProfessionalProfile:
    profile = db.query(ProfessionalProfile).filter(ProfessionalProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


# ─── Employment history ─────────────────────────────────────────────────────

@router.post("/employment", response_model=EmploymentHistoryOut, status_code=201)
def add_employment(
    payload: EmploymentHistoryCreate,
    current_user: User = Depends(require_role(UserRole.professional)),
    db: Session = Depends(get_db),
):
    profile = _my_profile(current_user, db)
    item = EmploymentHistory(profile_id=profile.id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/employment/{item_id}", status_code=204)
def delete_employment(
    item_id: str,
    current_user: User = Depends(require_role(UserRole.professional)),
    db: Session = Depends(get_db),
):
    item = db.get(EmploymentHistory, item_id)
    if not item or item.profile.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(item)
    db.commit()


# ─── Education ───────────────────────────────────────────────────────────────

@router.post("/education", response_model=EducationOut, status_code=201)
def add_education(
    payload: EducationCreate,
    current_user: User = Depends(require_role(UserRole.professional)),
    db: Session = Depends(get_db),
):
    profile = _my_profile(current_user, db)
    item = Education(profile_id=profile.id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/education/{item_id}", status_code=204)
def delete_education(
    item_id: str,
    current_user: User = Depends(require_role(UserRole.professional)),
    db: Session = Depends(get_db),
):
    item = db.get(Education, item_id)
    if not item or item.profile.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(item)
    db.commit()


# ─── Certifications ──────────────────────────────────────────────────────────

@router.post("/certifications", response_model=CertificationOut, status_code=201)
def add_certification(
    payload: CertificationCreate,
    current_user: User = Depends(require_role(UserRole.professional)),
    db: Session = Depends(get_db),
):
    profile = _my_profile(current_user, db)
    item = Certification(profile_id=profile.id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/certifications/{item_id}", status_code=204)
def delete_certification(
    item_id: str,
    current_user: User = Depends(require_role(UserRole.professional)),
    db: Session = Depends(get_db),
):
    item = db.get(Certification, item_id)
    if not item or item.profile.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(item)
    db.commit()
