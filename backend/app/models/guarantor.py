import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class Guarantor(Base):
    """A professional's guarantor: another registered platform user who vouches
    for the quality of their service (stakeholder feedback F15). The guarantor
    must already be on the platform and must accept the request.
    status: pending | accepted | declined | revoked."""

    __tablename__ = "guarantors"
    __table_args__ = (UniqueConstraint("professional_id", "guarantor_id", name="uq_guarantor_pair"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    professional_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False, index=True)
    guarantor_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String, default="pending")
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    professional: Mapped["User"] = relationship("User", foreign_keys=[professional_id])
    guarantor: Mapped["User"] = relationship("User", foreign_keys=[guarantor_id])
