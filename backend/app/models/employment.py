import uuid
from datetime import date, datetime

from sqlalchemy import String, Text, ForeignKey, DateTime, Date, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

def gen_uuid() -> str:
    return str(uuid.uuid4())

class EmploymentHistory(Base):
    """A past (or current) job a professional lists on their profile, shown
    like Upwork's "Employment history" section. Not the same as YH Connect
    project history, this is self-reported prior work experience."""

    __tablename__ = "employment_history"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    profile_id: Mapped[str] = mapped_column(String, ForeignKey("professional_profiles.id"), nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    employer: Mapped[str] = mapped_column(String, nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    profile: Mapped["ProfessionalProfile"] = relationship("ProfessionalProfile", back_populates="employment_history")
