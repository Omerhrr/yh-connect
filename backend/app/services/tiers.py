"""Talent tier system.

Tier is derived, never stored directly, from two independent admin-reviewed
verification stages on top of a professional's account:

NOTE (two-tier model): only Tiers 1 and 2 exist. Tier 1 = no verification
needed (capped). Tier 2 = identity verified (uncapped). The Tier 3 text below
is historical; proof of address is now an optional badge.

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

TIER_LABELS = {1: "Tier 1", 2: "Tier 2"}

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
    # Two tiers only (stakeholder feedback F5/F14): Tier 1 needs no
    # verification; Tier 2 is identity-verified. Proof of address is now an
    # optional trust badge and no longer affects the tier.
    return 2 if identity_verified else 1


def _setting_int(db: Session, key: str, default: int) -> int:
    row = db.get(PlatformSetting, key)
    if row and row.value:
        try:
            return int(float(row.value))
        except ValueError:
            pass
    return default


def get_daily_proposal_limit(db: Session, tier: int) -> Optional[int]:
    """Returns None for "no limit". Tier 2 (verified) is unlimited unless an
    admin sets `tier2_daily_proposal_limit` to a number greater than 0."""
    if tier >= 2:
        v = _setting_int(db, "tier2_daily_proposal_limit", 0)
        return v if v > 0 else None
    return _setting_int(db, "tier1_daily_proposal_limit", settings.TIER1_DAILY_PROPOSAL_LIMIT)


def get_concurrent_project_limit(db: Session, tier: int) -> Optional[int]:
    """Returns None for "no limit". Tier 2 (verified) is unlimited unless an
    admin sets `tier2_concurrent_project_limit` to a number greater than 0
    (how many jobs a verified talent may run at once, Q4)."""
    if tier >= 2:
        v = _setting_int(db, "tier2_concurrent_project_limit", 0)
        return v if v > 0 else None
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
