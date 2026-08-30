import enum
import uuid
from datetime import datetime

from sqlalchemy import String, Float, Text, ForeignKey, DateTime, Enum, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

def gen_uuid() -> str:
    return str(uuid.uuid4())

class ProjectStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    review = "review"
    completed = "completed"
    cancelled = "cancelled"

class BudgetType(str, enum.Enum):
    fixed = "fixed"
    hourly = "hourly"

class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    client_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    category_id: Mapped[str] = mapped_column(String, ForeignKey("categories.id"), nullable=False)
    assigned_professional_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)

    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    location: Mapped[str | None] = mapped_column(String, nullable=True)
    budget_min: Mapped[float] = mapped_column(Float, nullable=False)
    budget_max: Mapped[float] = mapped_column(Float, nullable=False)
    budget_type: Mapped[BudgetType] = mapped_column(Enum(BudgetType), default=BudgetType.fixed)
    skills: Mapped[str | None] = mapped_column(Text, nullable=True)

    timeline: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[ProjectStatus] = mapped_column(Enum(ProjectStatus), default=ProjectStatus.open)
    progress: Mapped[int] = mapped_column(Integer, default=0)

    closing_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    image_urls: Mapped[list | None] = mapped_column(JSON, nullable=True)
    video_url: Mapped[str | None] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    client: Mapped["User"] = relationship(
        "User", back_populates="projects", foreign_keys="[Project.client_id]"
    )
    assigned_professional: Mapped["User | None"] = relationship(
        "User", foreign_keys="[Project.assigned_professional_id]"
    )
    category: Mapped["Category"] = relationship("Category")
    bids: Mapped[list["Bid"]] = relationship("Bid", back_populates="project", cascade="all, delete-orphan")
    milestones: Mapped[list["Milestone"]] = relationship(
        "Milestone", back_populates="project", cascade="all, delete-orphan", order_by="Milestone.sort_order"
    )
    change_orders: Mapped[list["ChangeOrder"]] = relationship(
        "ChangeOrder", back_populates="project", cascade="all, delete-orphan"
    )

    @property
    def skills_list(self) -> list[str]:
        if not self.skills:
            return []
        return [s.strip() for s in self.skills.split(",") if s.strip()]

    @property
    def computed_progress(self) -> int:
        if not self.milestones:
            return self.progress
        from app.models.milestone import MilestoneStatus
        total = len(self.milestones)

        done = sum(1 for m in self.milestones if m.status in (MilestoneStatus.approved, MilestoneStatus.funded, MilestoneStatus.paid, MilestoneStatus.refunded))
        return round((done / total) * 100) if total else 0
