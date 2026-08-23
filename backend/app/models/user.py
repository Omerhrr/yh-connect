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
    # Optional, self-chosen, unique — lets people find/@-mention each other by
    # handle instead of full name. Lowercase, alphanumeric + underscore only
    # (see app/services/username.py), unset until the user picks one in
    # Settings.
    username: Mapped[str | None] = mapped_column(String, unique=True, index=True, nullable=True)
    # When first_name/last_name last actually changed. Gates how soon it can
    # change again (see PROFILE_NAME_CHANGE_COOLDOWN_HOURS) — a compromised
    # account's first move to reroute a payout is often renaming the profile
    # to match a bank account the intruder controls.
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
    # CAC (Corporate Affairs Commission) business-verification submission,
    # reviewed by admin before is_verified_business is granted — same
    # submit -> pending -> admin review -> verified/rejected shape as the
    # client NIN KYC flow above, but for the business itself rather than the
    # individual.
    cac_number: Mapped[str | None] = mapped_column(String, nullable=True)
    cac_document_url: Mapped[str | None] = mapped_column(String, nullable=True)
    business_verification_status: Mapped[str] = mapped_column(String, default="unverified", server_default="unverified")  # unverified|pending|verified|rejected
    business_verification_note: Mapped[str | None] = mapped_column(String, nullable=True)
    business_verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Prepaid escrow wallet balance (client-side). Topped up via Monnify in
    # any amount, then drawn down instantly when funding project milestones,
    # so a client doesn't need a fresh checkout for every milestone. Credited
    # back here (rather than a separate payout) when a dispute refunds a
    # milestone.
    wallet_balance: Mapped[float] = mapped_column(Float, default=0.0)

    # Optional, client-only: category ids the client is typically hiring for.
    # Never collected at registration, set later in Settings if the client
    # wants it to show on their profile.
    preferred_categories: Mapped[list | None] = mapped_column(JSON, nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    # Time-bound suspension. `is_active=False` + `suspended_until=None` means
    # "until further notice" (admin must manually unsuspend); a real
    # timestamp auto-lifts the suspension the next time anything checks it
    # (lazy check on login, same no-scheduler pattern used elsewhere). A
    # "forever" suspension in the admin UI doesn't use these fields at all —
    # it deletes/anonymizes the account outright (see AdminUserPatch).
    suspended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    suspended_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    suspension_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    # A "forever" suspension deletes the account rather than leaving it
    # suspended. We don't hard-DELETE the row (that would cascade-destroy
    # their projects/bids/wallet transactions/milestones — records the other
    # party and platform still need for history, disputes, and accounting).
    # Instead we anonymize PII, deactivate permanently, and flag it so the
    # UI treats it as gone: no login, no profile, name shown as "Deleted
    # user" anywhere it's still referenced.
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Client identity KYC (NIN-based), separate from account registration.
    # Required before a client can invite, message, or accept a bid from a
    # professional, i.e. before any direct contact that could lead to an
    # in-person meeting.
    nin: Mapped[str | None] = mapped_column(String, nullable=True)
    kyc_status: Mapped[KycStatus] = mapped_column(Enum(KycStatus), default=KycStatus.unverified)
    kyc_verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    kyc_note: Mapped[str | None] = mapped_column(String, nullable=True)

    # Email verification (separate from KYC identity verification above).
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    email_verification_token: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    email_verification_sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Bumped to invalidate all previously issued JWTs for this user (logout
    # everywhere / password change). Checked against the `tv` claim on decode.
    token_version: Mapped[int] = mapped_column(default=0)

    # Global opt-out for transactional email notifications. In-app
    # notifications always fire regardless; this only gates the email mirror.
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
