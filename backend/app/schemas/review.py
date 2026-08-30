from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ReviewCreate(BaseModel):
    project_id: str
    reviewee_id: str
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None


class ReviewRespond(BaseModel):
    response_body: str = Field(min_length=1, max_length=2000)


class ReviewOut(BaseModel):
    id: str
    project_id: str
    reviewer_id: str
    reviewer_name: Optional[str] = None
    reviewee_id: str
    rating: int
    comment: Optional[str] = None
    response_body: Optional[str] = None
    responded_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True
