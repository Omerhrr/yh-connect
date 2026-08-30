from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.project_invite import InviteStatus


class InviteCreate(BaseModel):
    professional_id: str
    proposed_amount: Optional[float] = None
    message: Optional[str] = None


class InviteUpdate(BaseModel):
    status: InviteStatus


class InviteOut(BaseModel):
    id: str
    project_id: str
    professional_id: str
    client_id: str
    proposed_amount: Optional[float] = None
    message: Optional[str] = None
    status: InviteStatus
    created_at: datetime
    project_title: Optional[str] = None
    professional_name: Optional[str] = None
    client_name: Optional[str] = None

    class Config:
        from_attributes = True
