import enum
import uuid
from datetime import datetime

from sqlalchemy import String, Float, Text, ForeignKey, DateTime, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

def gen_uuid() -> str:
    return str(uuid.uuid4())

class ChangeOrderStatus(str, enum.Enum):
    proposed = "proposed"
    approved = "approved"
    rejected = "rejected"

class ChangeOrder(Base):
    __tablename__ = "change_orders"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), nullable=False)
    proposed_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    amount_delta: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[ChangeOrderStatus] = mapped_column(Enum(ChangeOrderStatus), default=ChangeOrderStatus.proposed)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    resulting_milestone_id: Mapped[str | None] = mapped_column(String, ForeignKey("milestones.id"), nullable=True)

    project: Mapped["Project"] = relationship("Project", back_populates="change_orders")
