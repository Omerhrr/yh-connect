from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class MessageCreate(BaseModel):
    recipient_id: str
    body: str = ""
    project_id: Optional[str] = None
    attachment_url: Optional[str] = None


class MessageOut(BaseModel):
    id: str
    project_id: Optional[str] = None
    sender_id: str
    recipient_id: str
    body: str
    attachment_url: Optional[str] = None
    is_read: bool
    created_at: datetime
    sender_name: Optional[str] = None

    class Config:
        from_attributes = True


class ThreadOut(BaseModel):
    project_id: str
    project_title: str
    other_user_id: str
    other_user_name: str
    last_message: str
    last_message_at: datetime
    unread_count: int
