import uuid
from datetime import datetime

from sqlalchemy import String, ForeignKey, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class Education(Base):
    __tablename__ = "educations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    profile_id: Mapped[str] = mapped_column(String, ForeignKey("professional_profiles.id"), nullable=False)
    school: Mapped[str] = mapped_column(String, nullable=False)  # e.g. "University of Lagos"
    degree: Mapped[str | None] = mapped_column(String, nullable=True)  # e.g. "B.Sc."
    field_of_study: Mapped[str | None] = mapped_column(String, nullable=True)  # e.g. "Civil Engineering"
    start_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    end_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    profile: Mapped["ProfessionalProfile"] = relationship("ProfessionalProfile", back_populates="education")
