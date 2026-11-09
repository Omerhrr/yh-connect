import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class ConsultantApplication(Base):
    """A professional offering to act as consultant/middleman on a project whose
    client ticked "needs a consultant". Separate from bidding on the work itself.
    status: pending | appointed | declined | withdrawn."""

    __tablename__ = "consultant_applications"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), nullable=False, index=True)
    professional_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False, index=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    proposed_fee: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ConsultantNote(Base):
    """Supervision note by the appointed consultant, optionally attached to a bid
    with a verdict (recommend | not_recommend | neutral)."""

    __tablename__ = "consultant_notes"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), nullable=False, index=True)
    consultant_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    bid_id: Mapped[str | None] = mapped_column(String, nullable=True)
    verdict: Mapped[str] = mapped_column(String, default="neutral")
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
