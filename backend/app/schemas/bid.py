from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.bid import BidStatus


class BidCreate(BaseModel):
    amount: float
    cover_letter: Optional[str] = None
    estimated_days: Optional[int] = None


class BidUpdate(BaseModel):
    status: BidStatus


class BidOut(BaseModel):
    id: str
    project_id: str
    professional_id: str
    amount: float
    cover_letter: Optional[str] = None
    estimated_days: Optional[int] = None
    status: BidStatus
    created_at: datetime
    project_title: Optional[str] = None
    professional_name: Optional[str] = None
    professional_verification_status: Optional[str] = None
    professional_rating: Optional[float] = None
    professional_review_count: Optional[int] = None
    professional_portfolio_count: Optional[int] = None
    professional_hourly_rate: Optional[float] = None

    class Config:
        from_attributes = True
