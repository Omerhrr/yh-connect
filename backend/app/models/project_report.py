import uuid
from datetime import datetime

from sqlalchemy import String, Text, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class ProjectReport(Base):
    """A talent flagging a project listing as inappropriate/spam/scam for admin review."""

    __tablename__ = "project_reports"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), index=True)
    reporter_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), index=True)
    reason: Mapped[str] = mapped_column(String)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    project = relationship("Project")
    reporter = relationship("User")
