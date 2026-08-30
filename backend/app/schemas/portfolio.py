from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class PortfolioItemCreate(BaseModel):
    title: str
    description: Optional[str] = None
    image_urls: list[str] = []
    completed_date: Optional[date] = None


class PortfolioItemOut(BaseModel):
    id: str
    profile_id: str
    title: str
    description: Optional[str] = None
    image_urls: list[str] = []
    completed_date: Optional[date] = None
    created_at: datetime

    class Config:
        from_attributes = True
