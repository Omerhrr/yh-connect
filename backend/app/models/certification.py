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

    # Badge review: a certification only renders as a hoverable badge on the
    # public profile once admin-approved, self-reported entries stay
    # "unverified" and are just plain profile text until reviewed.
    verification_status: Mapped[str] = mapped_column(String, default="unverified", server_default="unverified")  # unverified|pending|verified|rejected
    verification_note: Mapped[str | None] = mapped_column(String, nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Canonical short badge label an admin assigns on approval (e.g. "COREN",
    # "ARCON", "BSc", "HND", "CERT") — distinct from the free-text `name` the
    # professional typed, so the profile shows a clean, consistent tag rather
    # than whatever wording they submitted. Falls back to `name` if unset.
    badge_name: Mapped[str | None] = mapped_column(String, nullable=True)

    profile: Mapped["ProfessionalProfile"] = relationship("ProfessionalProfile", back_populates="certifications")
