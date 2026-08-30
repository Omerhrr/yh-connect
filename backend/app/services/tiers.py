"""Talent tier system.

Tier is derived, never stored directly, from two independent admin-reviewed
verification stages on top of a professional's account:

- Tier 1 (default): no verification yet.
- Tier 2: identity verified - either the automated NIN check
  (`User.kyc_status`, same mechanism already used for client identity
  checks) or the admin-reviewed document flow (NIN slip / national ID /
  voters card / passport uploaded and approved,
  `ProfessionalProfile.verification_status`).
- Tier 3: identity verified *and* proof of address (utility bill, bank
  statement, etc.) verified (`ProfessionalProfile.address_verification_status`).

Daily proposal caps and concurrent active-project caps for tiers 1 and 2 are
admin-editable via the existing `platform_settings` key/value store (same
pattern as `platform_fee_percent`), falling back to the .env-configured
defaults below until an admin sets them. Tier 3 is uncapped by design.
"""

from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.bid import Bid
from app.models.profile import ProfessionalProfile
from app.models.project import Project, ProjectStatus
from app.models.platform_setting import PlatformSetting
from app.models.user import KycStatus, User, UserRole

TIER_LABELS = {1: "Tier 1", 2: "Tier 2", 3: "Tier 3"}

_ACTIVE_PROJECT_STATUSES = (ProjectStatus.in_progress, ProjectStatus.review)


def get_tier(user: User, profile: Optional[ProfessionalProfile]) -> int:
    """Compute a professional's current tier. Non-professionals are always
    tier 1 (the concept doesn't apply, this is just a safe default)."""
    if user.role != UserRole.professional:
        return 1
    identity_verified = (
        user.kyc_status == KycStatus.verified
        or bool(profile and profile.verification_status == "verified")
    )
    address_verified = bool(profile and profile.address_verification_status == "verified")
    if identity_verified and address_verified:
        return 3
    if identity_verified:
        return 2
    return 1


def _setting_int(db: Session, key: str, default: int) -> int:
    row = db.get(PlatformSetting, key)
    if row and row.value:
        try:
            return int(float(row.value))
        except ValueError:
            pass
    return default


def get_daily_proposal_limit(db: Session, tier: int) -> Optional[int]:
    """Returns None for "no limit" (tier 3)."""
    if tier >= 3:
        return None
    if tier == 2:
        return _setting_int(db, "tier2_daily_proposal_limit", settings.TIER2_DAILY_PROPOSAL_LIMIT)
    return _setting_int(db, "tier1_daily_proposal_limit", settings.TIER1_DAILY_PROPOSAL_LIMIT)


def get_concurrent_project_limit(db: Session, tier: int) -> Optional[int]:
    """Returns None for "no limit" (tier 3)."""
    if tier >= 3:
        return None
    if tier == 2:
        return _setting_int(db, "tier2_concurrent_project_limit", settings.TIER2_CONCURRENT_PROJECT_LIMIT)
    return _setting_int(db, "tier1_concurrent_project_limit", settings.TIER1_CONCURRENT_PROJECT_LIMIT)


def count_proposals_today(db: Session, professional_id: str) -> int:
    since = datetime.utcnow() - timedelta(hours=24)
    return (
        db.query(Bid)
        .filter(Bid.professional_id == professional_id, Bid.created_at >= since)
        .count()
    )


def count_active_projects(db: Session, professional_id: str) -> int:
    return (
        db.query(Project)
        .filter(
            Project.assigned_professional_id == professional_id,
            Project.status.in_(_ACTIVE_PROJECT_STATUSES),
        )
        .count()
    )
