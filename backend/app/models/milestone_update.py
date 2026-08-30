import uuid
from datetime import datetime

from sqlalchemy import String, Text, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

def gen_uuid() -> str:
    return str(uuid.uuid4())

class MilestoneUpdate(Base):
    __tablename__ = "milestone_updates"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    milestone_id: Mapped[str] = mapped_column(String, ForeignKey("milestones.id"), nullable=False)
    created_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    photo_urls: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    milestone: Mapped["Milestone"] = relationship("Milestone", back_populates="updates")
    author: Mapped["User"] = relationship("User")

    @property
    def photo_url_list(self) -> list[str]:
        if not self.photo_urls:
            return []
        return [u.strip() for u in self.photo_urls.split(",") if u.strip()]
