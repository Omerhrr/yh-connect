"""Helpers for reading admin-editable platform settings with a config fallback.

Settings edited in /admin/settings are stored in the `platform_settings`
key/value table. Anything not yet set there (fresh install, or a key an
admin hasn't touched) falls back to the corresponding `.env`/`config.py`
default, so nothing breaks before an admin ever opens the settings page.
"""

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


def get_featured_category_ids(db: Session) -> list[str]:
    row = db.get(PlatformSetting, "featured_category_ids")
    if not row or not row.value:
        return []
    return [c.strip() for c in row.value.split(",") if c.strip()]
