from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role
from app.db.session import get_db
from app.models.profile import ProfessionalProfile
from app.models.user import User, UserRole
from app.schemas.portfolio import PortfolioItemOut
from app.schemas.profile import ProfessionalOut, ProfileUpdate
from app.schemas.profile_extras import EmploymentHistoryOut, EducationOut, CertificationOut, WorkHistoryItem
from app.services.nlp_search import extract_keywords, match_categories
from app.services.professional_stats import compute_stats
from app.services.work_history import get_work_history

router = APIRouter(prefix="/professionals", tags=["professionals"])


def _portfolio_out(profile: ProfessionalProfile) -> list[PortfolioItemOut]:
    return [
        PortfolioItemOut(
            id=item.id,
            profile_id=item.profile_id,
            title=item.title,
            description=item.description,
            image_urls=item.image_url_list,
            completed_date=item.completed_date,
            created_at=item.created_at,
        )
        for item in profile.portfolio_items
    ]


def _to_out(profile: ProfessionalProfile, db: Session | None = None, include_stats: bool = False) -> ProfessionalOut:
    return ProfessionalOut(
        id=profile.id,
        user_id=profile.user_id,
        first_name=profile.user.first_name,
        last_name=profile.user.last_name,
        title=profile.title,
        category=profile.category,
        bio=profile.bio,
        location=profile.location,
        hourly_rate=profile.hourly_rate,
        years_experience=profile.years_experience,
        availability=profile.availability,
        skills=profile.skills_list,
        service_locations=profile.service_location_list,
        license_number=profile.license_number,
        is_verified=profile.is_verified,
        verification_status=profile.verification_status,
        rating=profile.rating,
        review_count=profile.review_count,
        portfolio_items=_portfolio_out(profile),
        has_payout_details=bool(profile.bank_account_number and profile.bank_code),
        bank_code=profile.bank_code,
        employment_history=[EmploymentHistoryOut.model_validate(e) for e in profile.employment_history],
        education=[EducationOut.model_validate(e) for e in profile.education],
        certifications=[CertificationOut.model_validate(c) for c in profile.certifications],
        languages=profile.language_list,
        stats=compute_stats(db, profile) if include_stats and db is not None else None,
    )


@router.get("", response_model=list[ProfessionalOut])
def list_professionals(
    category_id: Optional[str] = None,
    location: Optional[str] = None,
    q: Optional[str] = None,
    min_rating: Optional[float] = None,
    sort_by: Optional[str] = None,  # rating | price_asc | price_desc | newest | reviews
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    limit = max(1, min(limit, 100))
    offset = max(0, offset)

    query = db.query(ProfessionalProfile)
    if category_id:
        query = query.filter(ProfessionalProfile.category_id == category_id)
    if location:
        query = query.filter(ProfessionalProfile.location.ilike(f"%{location}%"))
    if min_rating is not None:
        query = query.filter(ProfessionalProfile.rating >= min_rating)

    if q:
        # Free-text search runs in Python (skills is a comma-joined string
        # column, not indexable), so filtering/sorting happens in Python too.
        # Natural-language queries ("my pipes are leaking, I need a
        # plumber") are understood via a keyword/synonym match against the
        # category taxonomy first; if nothing matches, we fall back to
        # plain keyword substring matching on title/name/skills.
        matched_categories = match_categories(q)
        all_profiles = query.all()
        if matched_categories:
            cat_rank = {c: i for i, c in enumerate(matched_categories)}
            profiles = [p for p in all_profiles if p.category_id in cat_rank]
            if not profiles:
                profiles = all_profiles
            else:
                profiles.sort(key=lambda p: (cat_rank.get(p.category_id, 999), -(p.rating or 0)))
        else:
            keywords = extract_keywords(q) or [q.lower()]
            profiles = [
                p for p in all_profiles
                if any(
                    kw in p.title.lower()
                    or kw in (p.user.first_name + " " + p.user.last_name).lower()
                    or kw in (p.skills or "").lower()
                    for kw in keywords
                )
            ]
    else:
        profiles = query.all()

    sort_map = {
        "rating": lambda p: -p.rating,
        "price_asc": lambda p: p.hourly_rate or 0,
        "price_desc": lambda p: -(p.hourly_rate or 0),
        "newest": lambda p: p.user.created_at,
        "reviews": lambda p: -p.review_count,
    }
    if sort_by in sort_map:
        reverse = sort_by == "newest"
        profiles = sorted(profiles, key=sort_map[sort_by], reverse=reverse)

    profiles = profiles[offset : offset + limit]
    return [_to_out(p) for p in profiles]


@router.get("/me", response_model=ProfessionalOut)
def get_my_profile(current_user: User = Depends(require_role(UserRole.professional)), db: Session = Depends(get_db)):
    profile = db.query(ProfessionalProfile).filter(ProfessionalProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return _to_out(profile, db, include_stats=True)


@router.patch("/me", response_model=ProfessionalOut)
def update_my_profile(
    payload: ProfileUpdate,
    current_user: User = Depends(require_role(UserRole.professional)),
    db: Session = Depends(get_db),
):
    profile = db.query(ProfessionalProfile).filter(ProfessionalProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    data = payload.model_dump(exclude_unset=True)
    if "skills" in data and data["skills"] is not None:
        data["skills"] = ",".join(data["skills"])
    if "service_locations" in data and data["service_locations"] is not None:
        data["service_locations"] = ",".join(data["service_locations"])
    if "languages" in data and data["languages"] is not None:
        data["languages"] = ",".join(f"{l['name']}:{l['level']}" for l in data["languages"])
    for field, value in data.items():
        setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return _to_out(profile, db, include_stats=True)


@router.get("/{profile_id}", response_model=ProfessionalOut)
def get_professional(profile_id: str, db: Session = Depends(get_db)):
    profile = db.get(ProfessionalProfile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Professional not found")
    return _to_out(profile, db, include_stats=True)


@router.get("/{profile_id}/work-history", response_model=list[WorkHistoryItem])
def professional_work_history(profile_id: str, db: Session = Depends(get_db)):
    profile = db.get(ProfessionalProfile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Professional not found")
    return get_work_history(db, profile.user_id)
