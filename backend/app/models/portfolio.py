import uuid
from datetime import datetime

from sqlalchemy import String, Text, ForeignKey, DateTime, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class PortfolioItem(Base):
    __tablename__ = "portfolio_items"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    profile_id: Mapped[str] = mapped_column(String, ForeignKey("professional_profiles.id"), nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_urls: Mapped[str | None] = mapped_column(Text, nullable=True)  # comma-separated
    completed_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    profile: Mapped["ProfessionalProfile"] = relationship("ProfessionalProfile", back_populates="portfolio_items")

    @property
    def image_url_list(self) -> list[str]:
        if not self.image_urls:
            return []
        return [u.strip() for u in self.image_urls.split(",") if u.strip()]
