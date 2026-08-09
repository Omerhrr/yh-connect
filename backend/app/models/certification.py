import uuid
from datetime import date, datetime

from sqlalchemy import String, ForeignKey, DateTime, Date, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class Certification(Base):
    __tablename__ = "certifications"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    profile_id: Mapped[str] = mapped_column(String, ForeignKey("professional_profiles.id"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)  # e.g. "COREN Registration"
    issuing_body: Mapped[str | None] = mapped_column(String, nullable=True)  # e.g. "Council for the Regulation of Engineering in Nigeria"
    issued_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    credential_url: Mapped[str | None] = mapped_column(String, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    profile: Mapped["ProfessionalProfile"] = relationship("ProfessionalProfile", back_populates="certifications")
