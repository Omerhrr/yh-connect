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

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    project: Mapped["Project"] = relationship("Project", back_populates="bids")
    professional: Mapped["User"] = relationship("User", back_populates="bids")
