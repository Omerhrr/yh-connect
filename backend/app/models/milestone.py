import enum
import uuid
from datetime import datetime

from sqlalchemy import String, Float, Text, ForeignKey, DateTime, Enum, Integer, Date, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

def gen_uuid() -> str:
    return str(uuid.uuid4())

class MilestoneStatus(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    submitted = "submitted"
    approved = "approved"
    funded = "funded"
    paid = "paid"
    refunded = "refunded"
    rejected = "rejected"

class Milestone(Base):
    __tablename__ = "milestones"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), nullable=False)

    created_by: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    due_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    status: Mapped[MilestoneStatus] = mapped_column(Enum(MilestoneStatus), default=MilestoneStatus.pending)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    submitted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    auto_release_reminder_sent: Mapped[bool] = mapped_column(Boolean, default=False)

    rejection_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    withheld_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    withheld_release_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    withheld_released_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    project: Mapped["Project"] = relationship("Project", back_populates="milestones")
    updates: Mapped[list["MilestoneUpdate"]] = relationship(
        "MilestoneUpdate", back_populates="milestone", cascade="all, delete-orphan", order_by="MilestoneUpdate.created_at"
    )
