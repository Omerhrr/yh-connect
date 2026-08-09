import enum
import uuid
from datetime import datetime

from sqlalchemy import String, Float, Text, ForeignKey, DateTime, Enum, Integer, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class MilestoneStatus(str, enum.Enum):
    pending = "pending"       # defined, not started
    in_progress = "in_progress"
    submitted = "submitted"   # professional says it's done, awaiting client approval
    approved = "approved"     # client approved
    funded = "funded"         # client has paid into escrow for this milestone
    paid = "paid"             # disbursed to professional
    refunded = "refunded"     # escrow funds were returned to the client (dispute outcome)


class Milestone(Base):
    __tablename__ = "milestones"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    due_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    status: Mapped[MilestoneStatus] = mapped_column(Enum(MilestoneStatus), default=MilestoneStatus.pending)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    project: Mapped["Project"] = relationship("Project", back_populates="milestones")
    updates: Mapped[list["MilestoneUpdate"]] = relationship(
        "MilestoneUpdate", back_populates="milestone", cascade="all, delete-orphan", order_by="MilestoneUpdate.created_at"
    )
