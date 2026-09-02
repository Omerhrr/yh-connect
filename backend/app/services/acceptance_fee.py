"""Admin-configurable acceptance fee: the final gate a talent must clear
(by paying from their wallet) before job commencement, after the contract
is approved. Stored as a single JSON blob under platform_settings, same
pattern as receipt_settings / project_media_settings.

Shape:
{
  "mode": "general" | "rule_based",
  "general_amount": 5000,
  "rules": [
    {"skill_level": "skilled" | "semi_skilled" | "unskilled" | null,
     "min_price": 0 | null, "max_price": 1000000 | null, "amount": 10000},
    ...
  ]
}

Rules are evaluated in order; the first one whose skill_level (if set)
matches the professional's computed skill tier AND whose price range (if
set) contains the agreed project amount wins. If nothing matches, or mode
is "general", general_amount is used.
"""

import json

from sqlalchemy.orm import Session

from app.models.certification import Certification
from app.models.platform_setting import PlatformSetting
from app.models.profile import ProfessionalProfile
from app.models.user import User

ACCEPTANCE_FEE_SETTINGS_KEY = "acceptance_fee_settings"

SKILL_LEVELS = ["unskilled", "semi_skilled", "skilled"]

DEFAULTS = {"mode": "general", "general_amount": 0.0, "rules": []}


def get_acceptance_fee_settings(db: Session) -> dict:
    row = db.get(PlatformSetting, ACCEPTANCE_FEE_SETTINGS_KEY)
    if not row or not row.value:
        return dict(DEFAULTS)
    try:
        data = json.loads(row.value)
    except ValueError:
        return dict(DEFAULTS)
    merged = dict(DEFAULTS)
    merged.update({k: v for k, v in data.items() if v is not None})
    return merged


def save_acceptance_fee_settings(db: Session, updates: dict) -> dict:
    current = get_acceptance_fee_settings(db)
    current.update({k: v for k, v in updates.items() if v is not None})
    row = db.get(PlatformSetting, ACCEPTANCE_FEE_SETTINGS_KEY)
    value = json.dumps(current)
    if row:
        row.value = value
        row.value_type = "json"
    else:
        db.add(PlatformSetting(key=ACCEPTANCE_FEE_SETTINGS_KEY, value=value, value_type="json"))
    db.commit()
    return current


def get_professional_skill_level(db: Session, professional_id: str) -> str:
    """Highest skill tier across the professional's certifications; admin
    assigns skill_level per certification/badge when verifying it."""
    profile = db.query(ProfessionalProfile).filter(ProfessionalProfile.user_id == professional_id).first()
    if not profile:
        return "unskilled"
    best = "unskilled"
    for cert in profile.certifications:
        if cert.skill_level in SKILL_LEVELS and SKILL_LEVELS.index(cert.skill_level) > SKILL_LEVELS.index(best):
            best = cert.skill_level
    return best


def compute_acceptance_fee(db: Session, professional_id: str, agreed_price: float) -> float:
    settings_data = get_acceptance_fee_settings(db)
    if settings_data.get("mode") != "rule_based":
        return float(settings_data.get("general_amount") or 0.0)

    skill_level = get_professional_skill_level(db, professional_id)
    for rule in settings_data.get("rules") or []:
        rule_skill = rule.get("skill_level")
        if rule_skill and rule_skill != skill_level:
            continue
        min_price = rule.get("min_price")
        max_price = rule.get("max_price")
        if min_price is not None and agreed_price < min_price:
            continue
        if max_price is not None and agreed_price > max_price:
            continue
        return float(rule.get("amount") or 0.0)

    return float(settings_data.get("general_amount") or 0.0)
