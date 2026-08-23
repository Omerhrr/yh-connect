import enum
import uuid
from datetime import datetime

from sqlalchemy import String, Float, Text, ForeignKey, DateTime, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class BidStatus(str, enum.Enum):
    pending = "pending"
    shortlisted = "shortlisted"
    # The client proposed final terms that differ from the original bid
    # amount — an explicit offer the professional must accept before the
    # project locks in, instead of the client just silently overriding the
    # bid on accept. Mirrors Upwork's separate "send offer" step.
    offered = "offered"
    accepted = "accepted"
    rejected = "rejected"
    withdrawn = "withdrawn"


class Bid(Base):
    __tablename__ = "bids"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), nullable=False)
    professional_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)

    amount: Mapped[float] = mapped_column(Float, nullable=False)
    cover_letter: Mapped[str | None] = mapped_column(Text, nullable=True)
    estimated_days: Mapped[int | None] = mapped_column(nullable=True)
    status: Mapped[BidStatus] = mapped_column(Enum(BidStatus), default=BidStatus.pending)
    # Set when the client offers different final terms than the original
    # proposal (status becomes "offered" instead of "accepted" directly).
    # Null once accepted the ordinary way (offer == original amount).
    offered_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    offer_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    project: Mapped["Project"] = relationship("Project", back_populates="bids")
    professional: Mapped["User"] = relationship("User", back_populates="bids")
