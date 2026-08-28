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


class MilestoneRejectIn(BaseModel):
    note: str


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
    # Who defined this milestone (client or the assigned professional).
    created_by: Optional[str] = None
    created_by_name: Optional[str] = None
    title: str
    description: Optional[str] = None
    amount: float
    due_date: Optional[date] = None
    status: MilestoneStatus
    sort_order: int
    created_at: datetime
    submitted_at: Optional[datetime] = None
    # So the client sees the fee before they fund/release, not after, and
    # can see exactly what the professional nets.
    platform_fee_percent: float = 0.0
    net_to_professional: float = 0.0
    rejection_note: Optional[str] = None
    rejected_at: Optional[datetime] = None
    # Payment protection holdback (see platform_settings
    # "payment_withholding_percent"/"payment_withholding_release_days").
    # withholding_percent/withholding_release_days are the platform's
    # current configured values (shown to talent before payout so it's never
    # a surprise); withheld_amount/withheld_release_at/withheld_released_at
    # only get set once this specific milestone's payout has actually been
    # disbursed with a holdback applied.
    withholding_percent: float = 0.0
    withholding_release_days: float = 0.0
    withheld_amount: Optional[float] = None
    withheld_release_at: Optional[datetime] = None
    withheld_released_at: Optional[datetime] = None
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
    resulting_milestone_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
