import enum
import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, Enum, Boolean, Text, JSON, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

class UserRole(str, enum.Enum):
    client = "client"
    professional = "professional"
    admin = "admin"

class KycStatus(str, enum.Enum):
    unverified = "unverified"
    pending = "pending"
    verified = "verified"
    rejected = "rejected"

def gen_uuid() -> str:
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    first_name: Mapped[str] = mapped_column(String, nullable=False)
    last_name: Mapped[str] = mapped_column(String, nullable=False)

    username: Mapped[str | None] = mapped_column(String, unique=True, index=True, nullable=True)

    name_changed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)

    avatar_url: Mapped[str | None] = mapped_column(String, nullable=True)

    company_name: Mapped[str | None] = mapped_column(String, nullable=True)
    industry: Mapped[str | None] = mapped_column(String, nullable=True)
    company_logo_url: Mapped[str | None] = mapped_column(String, nullable=True)
    company_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    company_website: Mapped[str | None] = mapped_column(String, nullable=True)
    is_verified_business: Mapped[bool] = mapped_column(Boolean, default=False)

    cac_number: Mapped[str | None] = mapped_column(String, nullable=True)
    cac_document_url: Mapped[str | None] = mapped_column(String, nullable=True)
    business_verification_status: Mapped[str] = mapped_column(String, default="unverified", server_default="unverified")
    business_verification_note: Mapped[str | None] = mapped_column(String, nullable=True)
    business_verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    wallet_balance: Mapped[float] = mapped_column(Float, default=0.0)

    preferred_categories: Mapped[list | None] = mapped_column(JSON, nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    suspended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    suspended_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    suspension_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    nin: Mapped[str | None] = mapped_column(String, nullable=True)
    kyc_status: Mapped[KycStatus] = mapped_column(Enum(KycStatus), default=KycStatus.unverified)
    kyc_verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    kyc_note: Mapped[str | None] = mapped_column(String, nullable=True)

    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    email_verification_token: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    email_verification_sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    token_version: Mapped[int] = mapped_column(default=0)

    email_notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    profile: Mapped["ProfessionalProfile"] = relationship(
        "ProfessionalProfile", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    projects: Mapped[list["Project"]] = relationship(
        "Project",
        back_populates="client",
        cascade="all, delete-orphan",
        foreign_keys="[Project.client_id]",
    )
    bids: Mapped[list["Bid"]] = relationship(
        "Bid", back_populates="professional", cascade="all, delete-orphan"
    )
