import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class IssuingBody(Base):
    """An external professional/issuing body (ARCON, COREN, CORBON, ...) that
    helps YH Connect verify the certificates it issued. `aliases` is a
    comma-separated list of lowercase spellings matched against the free-text
    `issuing_body` a talent types on a certification."""

    __tablename__ = "issuing_bodies"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    aliases: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    accounts: Mapped[list["VerifierAccount"]] = relationship("VerifierAccount", back_populates="body")

    @property
    def match_terms(self) -> list[str]:
        terms = {self.name.strip().lower()}
        for a in (self.aliases or "").split(","):
            if a.strip():
                terms.add(a.strip().lower())
        return sorted(terms)


class VerifierAccount(Base):
    """Login for a person at an issuing body. Deliberately separate from User
    (and from the admin role): it can only ever see and sign off certificates
    that match its own body."""

    __tablename__ = "verifier_accounts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    body_id: Mapped[str] = mapped_column(String, ForeignKey("issuing_bodies.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    token_version: Mapped[int] = mapped_column(Integer, default=0)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    body: Mapped["IssuingBody"] = relationship("IssuingBody", back_populates="accounts")
