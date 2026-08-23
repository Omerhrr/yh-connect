from typing import Optional

from pydantic import BaseModel

from app.schemas.category import CategoryOut
from app.schemas.portfolio import PortfolioItemOut
from app.schemas.profile_extras import (
    EmploymentHistoryOut,
    EducationOut,
    CertificationOut,
    LanguageEntry,
    ProfessionalStats,
)


class ProfileUpdate(BaseModel):
    title: Optional[str] = None
    category_id: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    hourly_rate: Optional[float] = None
    years_experience: Optional[str] = None
    availability: Optional[str] = None
    skills: Optional[list[str]] = None
    license_number: Optional[str] = None
    service_locations: Optional[list[str]] = None
    languages: Optional[list[LanguageEntry]] = None


class ProfessionalOut(BaseModel):
    id: str
    user_id: str
    first_name: str
    last_name: str
    title: str
    category: CategoryOut
    bio: Optional[str] = None
    location: Optional[str] = None
    hourly_rate: Optional[float] = None
    years_experience: Optional[str] = None
    availability: str
    skills: list[str] = []
    service_locations: list[str] = []
    license_number: Optional[str] = None
    is_verified: bool
    verification_status: str = "unverified"
    # Rejection reasons set by admins, surfaced to the professional so they
    # know what to fix before resubmitting.
    verification_note: Optional[str] = None
    address_verification_status: str = "unverified"
    address_verification_note: Optional[str] = None
    # Talent tier (1-3). Only the professional's own view (/professionals/me)
    # includes it; public listings and profiles return None so clients never
    # see it. The concept is personal to the talent, not a client-facing badge.
    tier: Optional[int] = None
    rating: float
    review_count: int
    portfolio_items: list[PortfolioItemOut] = []
    has_payout_details: bool = False
    bank_code: Optional[str] = None
    employment_history: list[EmploymentHistoryOut] = []
    education: list[EducationOut] = []
    certifications: list[CertificationOut] = []
    languages: list[LanguageEntry] = []
    stats: Optional[ProfessionalStats] = None

    class Config:
        from_attributes = True
