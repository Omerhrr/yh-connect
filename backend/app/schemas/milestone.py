from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel

from app.models.milestone import MilestoneStatus


class MilestoneCreate(BaseModel):
    title: str
    description: Optional[str] = None
    amount: float
    due_date: Optional[date] = None


class MilestoneUpdateIn(BaseModel):
    note: Optional[str] = None
    photo_urls: list[str] = []


class MilestoneUpdateOut(BaseModel):
    id: str
    milestone_id: str
    created_by: str
    author_name: Optional[str] = None
    note: Optional[str] = None
    photo_urls: list[str] = []
    created_at: datetime

    class Config:
        from_attributes = True


class MilestoneOut(BaseModel):
    id: str
    project_id: str
    title: str
    description: Optional[str] = None
    amount: float
    due_date: Optional[date] = None
    status: MilestoneStatus
    sort_order: int
    created_at: datetime
    updates: list[MilestoneUpdateOut] = []

    class Config:
        from_attributes = True


class ChangeOrderCreate(BaseModel):
    description: str
    amount_delta: float = 0.0


class ChangeOrderOut(BaseModel):
    id: str
    project_id: str
    proposed_by: str
    description: str
    amount_delta: float
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
