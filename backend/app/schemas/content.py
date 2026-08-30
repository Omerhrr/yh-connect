from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel

from app.models.content import HighlightType

class SiteContentBlockOut(BaseModel):
    key: str
    data: dict[str, Any]
    updated_at: datetime

    class Config:
        from_attributes = True

class SiteContentBlockUpsert(BaseModel):
    data: dict[str, Any]

class ContentPageOut(BaseModel):
    id: str
    slug: str
    title: str
    body: str
    updated_by: Optional[str] = None
    updated_at: datetime

    class Config:
        from_attributes = True

class ContentPageUpsert(BaseModel):
    slug: str
    title: str
    body: str

class ContentPagePatch(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None

class BlogPostOut(BaseModel):
    id: str
    slug: str
    title: str
    excerpt: Optional[str] = None
    body: str
    cover_image_url: Optional[str] = None
    author_name: Optional[str] = None
    published: bool
    published_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class BlogPostCreate(BaseModel):
    slug: str
    title: str
    excerpt: Optional[str] = None
    body: str = ""
    cover_image_url: Optional[str] = None
    author_name: Optional[str] = None
    published: bool = False

class BlogPostPatch(BaseModel):
    slug: Optional[str] = None
    title: Optional[str] = None
    excerpt: Optional[str] = None
    body: Optional[str] = None
    cover_image_url: Optional[str] = None
    author_name: Optional[str] = None
    published: Optional[bool] = None

class HighlightOut(BaseModel):
    id: str
    type: HighlightType
    title: str
    body: Optional[str] = None
    image_url: Optional[str] = None
    sort_order: int
    active: bool

    class Config:
        from_attributes = True

class HighlightCreate(BaseModel):
    type: HighlightType
    title: str
    body: Optional[str] = None
    image_url: Optional[str] = None
    sort_order: int = 0
    active: bool = True

class HighlightPatch(BaseModel):
    type: Optional[HighlightType] = None
    title: Optional[str] = None
    body: Optional[str] = None
    image_url: Optional[str] = None
    sort_order: Optional[int] = None
    active: Optional[bool] = None

class FaqItemOut(BaseModel):
    id: str
    question: str
    answer: str
    category: str
    sort_order: int
    active: bool
    updated_at: datetime

    class Config:
        from_attributes = True

class FaqItemCreate(BaseModel):
    question: str
    answer: str
    category: str = "General"
    sort_order: int = 0
    active: bool = True

class FaqItemPatch(BaseModel):
    question: Optional[str] = None
    answer: Optional[str] = None
    category: Optional[str] = None
    sort_order: Optional[int] = None
    active: Optional[bool] = None

class CategoryCreate(BaseModel):
    id: str
    label: str
    icon: str = "HardHat"
    description: Optional[str] = None

class CategoryPatch(BaseModel):
    label: Optional[str] = None
    icon: Optional[str] = None
    description: Optional[str] = None
