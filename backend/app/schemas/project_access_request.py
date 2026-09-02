from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.project_access_request import AccessRequestType, AccessRequestStatus

class AccessRequestCreate(BaseModel):
    request_type: AccessRequestType
    note: Optional[str] = None

class AccessRequestRespond(BaseModel):
    status: AccessRequestStatus

    address: Optional[str] = None
    phone: Optional[str] = None
    details: Optional[str] = None
    # Client's proposed inspection visit date/time, required when approving
    # an inspection request — kicks off the mutual-agreement loop.
    proposed_datetime: Optional[datetime] = None

class ScheduleRespond(BaseModel):
    """Talent or client responding to the other side's proposed inspection
    date/time: either accept it outright, or counter with a different one."""
    action: str  # "accept" | "counter"
    datetime: Optional[datetime] = None

class AccessRequestOut(BaseModel):
    id: str
    project_id: str
    professional_id: str
    client_id: str
    request_type: AccessRequestType
    status: AccessRequestStatus
    note: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    details: Optional[str] = None
    created_at: datetime
    responded_at: Optional[datetime] = None
    proposed_datetime: Optional[datetime] = None
    proposed_by: Optional[str] = None
    schedule_status: Optional[str] = None
    scheduled_datetime: Optional[datetime] = None
    project_title: Optional[str] = None
    professional_name: Optional[str] = None
    client_name: Optional[str] = None

    class Config:
        from_attributes = True
