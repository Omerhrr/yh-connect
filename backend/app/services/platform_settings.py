"""Helpers for reading admin-editable platform settings with a config fallback.

Settings edited in /admin/settings are stored in the `platform_settings`
key/value table. Anything not yet set there (fresh install, or a key an
admin hasn't touched) falls back to the corresponding `.env`/`config.py`
default, so nothing breaks before an admin ever opens the settings page.
"""

import json

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.platform_setting import PlatformSetting


def get_platform_fee_percent(db: Session) -> float:
    row = db.get(PlatformSetting, "platform_fee_percent")
    if row and row.value:
        try:
            return float(row.value)
        except ValueError:
            pass
    return settings.PLATFORM_FEE_PERCENT


def get_milestone_auto_release_days(db: Session) -> float:
    row = db.get(PlatformSetting, "milestone_auto_release_days")
    if row and row.value:
        try:
            return float(row.value)
        except ValueError:
            pass
    return settings.MILESTONE_AUTO_RELEASE_DAYS


def get_dispute_direct_resolution_hours(db: Session) -> float:
    row = db.get(PlatformSetting, "dispute_direct_resolution_hours")
    if row and row.value:
        try:
            return float(row.value)
        except ValueError:
            pass
    return settings.DISPUTE_DIRECT_RESOLUTION_HOURS


def get_profile_name_change_cooldown_hours(db: Session) -> float:
    row = db.get(PlatformSetting, "profile_name_change_cooldown_hours")
    if row and row.value:
        try:
            return float(row.value)
        except ValueError:
            pass
    return settings.PROFILE_NAME_CHANGE_COOLDOWN_HOURS


def get_featured_category_ids(db: Session) -> list[str]:
    row = db.get(PlatformSetting, "featured_category_ids")
    if not row or not row.value:
        return []
    return [c.strip() for c in row.value.split(",") if c.strip()]


RECEIPT_SETTINGS_KEY = "receipt_settings"


def get_receipt_settings(db: Session) -> dict:
    """Admin-configured PDF receipt branding (template, theme colors, font,
    logo, company name/footer) — stored as one JSON blob under a single
    platform_settings key rather than one row per field, since it's edited
    and read as a single unit. Falls back to the schema's own defaults
    (ReceiptSettingsOut field defaults) if nothing's been saved yet."""
    from app.schemas.receipt import ReceiptSettingsOut

    row = db.get(PlatformSetting, RECEIPT_SETTINGS_KEY)
    if not row or not row.value:
        return ReceiptSettingsOut().model_dump()
    try:
        data = json.loads(row.value)
    except ValueError:
        return ReceiptSettingsOut().model_dump()
    # Merge over defaults so a partially-saved/older blob (e.g. before a new
    # field was added) doesn't crash template rendering with a KeyError.
    defaults = ReceiptSettingsOut().model_dump()
    defaults.update({k: v for k, v in data.items() if v is not None})
    return defaults


def save_receipt_settings(db: Session, updates: dict) -> dict:
    current = get_receipt_settings(db)
    current.update({k: v for k, v in updates.items() if v is not None})
    row = db.get(PlatformSetting, RECEIPT_SETTINGS_KEY)
    value = json.dumps(current)
    if row:
        row.value = value
        row.value_type = "json"
    else:
        db.add(PlatformSetting(key=RECEIPT_SETTINGS_KEY, value=value, value_type="json"))
    db.commit()
    return current
