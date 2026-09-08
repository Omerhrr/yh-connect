from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class StateSetting(Base):
    """Whether a Nigerian state is currently selectable for a project's
    location. LGA lists themselves are static reference data (see
    app/data/nigeria_states.py) — only the per-state on/off toggle needs to
    be admin-configurable and persisted."""

    __tablename__ = "state_settings"

    name: Mapped[str] = mapped_column(String, primary_key=True)
    active: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
