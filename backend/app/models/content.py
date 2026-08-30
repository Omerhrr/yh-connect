import enum
import uuid
from datetime import datetime

from sqlalchemy import String, Text, DateTime, Boolean, Integer, Enum
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class ContentPage(Base):
    """Admin-editable static pages (privacy, terms, how-it-works, ...)."""

    __tablename__ = "content_pages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    slug: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    updated_by: Mapped[str | None] = mapped_column(String, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SiteContentBlock(Base):
    """Admin-editable structured content for site chrome and marketing
    sections (header nav, footer, homepage hero/sections, ...). One row per
    logical section, keyed by a fixed string key the frontend knows about
    (e.g. "header.nav_links", "footer", "homepage.hero"); `data` holds the
    section's fields as JSON, shape is defined and validated on the frontend
    (src/lib/siteContent.ts) since it varies per key. Sections with no row
    yet simply fall back to the frontend's hardcoded defaults, same pattern
    as ContentPage."""

    __tablename__ = "site_content_blocks"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    data: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    updated_by: Mapped[str | None] = mapped_column(String, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class BlogPost(Base):
    __tablename__ = "blog_posts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    slug: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    excerpt: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    cover_image_url: Mapped[str | None] = mapped_column(String, nullable=True)
    author_name: Mapped[str | None] = mapped_column(String, nullable=True)
    published: Mapped[bool] = mapped_column(Boolean, default=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class FaqItem(Base):
    """Admin-editable FAQ entries shown on the public /faq page, grouped by
    category and ordered with `sort_order` within each category."""

    __tablename__ = "faq_items"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    question: Mapped[str] = mapped_column(String, nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False, default="General")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class HighlightType(str, enum.Enum):
    testimonial = "testimonial"
    stat = "stat"
    banner = "banner"


class HomepageHighlight(Base):
    __tablename__ = "homepage_highlights"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    type: Mapped[HighlightType] = mapped_column(Enum(HighlightType), nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
