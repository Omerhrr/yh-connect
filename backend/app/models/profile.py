import uuid

from sqlalchemy import String, Float, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class ProfessionalProfile(Base):
    __tablename__ = "professional_profiles"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), unique=True, nullable=False)

    title: Mapped[str] = mapped_column(String, nullable=False)  # e.g. "Structural Engineer"
    category_id: Mapped[str] = mapped_column(String, ForeignKey("categories.id"), nullable=False)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    location: Mapped[str | None] = mapped_column(String, nullable=True)
    hourly_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    years_experience: Mapped[str | None] = mapped_column(String, nullable=True)
    availability: Mapped[str] = mapped_column(String, default="available")  # available | busy | offline
    skills: Mapped[str | None] = mapped_column(Text, nullable=True)  # comma-separated
    license_number: Mapped[str | None] = mapped_column(String, nullable=True)  # e.g. COREN/ARCON reg no.
    # Comma-separated "Name:Level" pairs, e.g. "English:Native,Yoruba:Fluent"
    languages: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_verified: Mapped[bool] = mapped_column(default=False)
    rating: Mapped[float] = mapped_column(Float, default=0.0)
    review_count: Mapped[int] = mapped_column(default=0)
    service_locations: Mapped[str | None] = mapped_column(Text, nullable=True)  # comma-separated

    # Verification (Phase 1)
    verification_status: Mapped[str] = mapped_column(String, default="unverified")  # unverified|pending|verified|rejected
    id_document_url: Mapped[str | None] = mapped_column(String, nullable=True)
    license_document_url: Mapped[str | None] = mapped_column(String, nullable=True)
    insurance_document_url: Mapped[str | None] = mapped_column(String, nullable=True)
    verification_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Payout details (Phase 7, Monnify disbursement)
    bank_code: Mapped[str | None] = mapped_column(String, nullable=True)
    bank_account_number: Mapped[str | None] = mapped_column(String, nullable=True)
    bank_account_name: Mapped[str | None] = mapped_column(String, nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="profile")
    category: Mapped["Category"] = relationship("Category")
    portfolio_items: Mapped[list["PortfolioItem"]] = relationship(
        "PortfolioItem", back_populates="profile", cascade="all, delete-orphan", order_by="PortfolioItem.created_at.desc()"
    )
    employment_history: Mapped[list["EmploymentHistory"]] = relationship(
        "EmploymentHistory", back_populates="profile", cascade="all, delete-orphan",
        order_by="EmploymentHistory.sort_order, EmploymentHistory.start_date.desc()",
    )
    education: Mapped[list["Education"]] = relationship(
        "Education", back_populates="profile", cascade="all, delete-orphan",
        order_by="Education.sort_order, Education.end_year.desc()",
    )
    certifications: Mapped[list["Certification"]] = relationship(
        "Certification", back_populates="profile", cascade="all, delete-orphan",
        order_by="Certification.sort_order, Certification.issued_date.desc()",
    )

    @property
    def skills_list(self) -> list[str]:
        if not self.skills:
            return []
        return [s.strip() for s in self.skills.split(",") if s.strip()]

    @property
    def service_location_list(self) -> list[str]:
        if not self.service_locations:
            return []
        return [s.strip() for s in self.service_locations.split(",") if s.strip()]

    @property
    def language_list(self) -> list[dict]:
        if not self.languages:
            return []
        out = []
        for part in self.languages.split(","):
            part = part.strip()
            if not part:
                continue
            if ":" in part:
                name, level = part.split(":", 1)
            else:
                name, level = part, "Conversational"
            out.append({"name": name.strip(), "level": level.strip()})
        return out
