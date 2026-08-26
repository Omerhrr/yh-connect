from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.project_access_request import AccessRequestType, AccessRequestStatus


class AccessRequestCreate(BaseModel):
    request_type: AccessRequestType
    note: Optional[str] = None


class AccessRequestRespond(BaseModel):
    status: AccessRequestStatus
    # Only used (and only meaningful) when approving an inspection request —
    # the client supplies where/how the professional can reach the site.
    address: Optional[str] = None
    phone: Optional[str] = None
    details: Optional[str] = None


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
    project_title: Optional[str] = None
    professional_name: Optional[str] = None
    client_name: Optional[str] = None

    class Config:
        from_attributes = True
