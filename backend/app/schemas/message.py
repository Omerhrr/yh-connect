from datetime import datetime
from typing import Optional

from pydantic import BaseModel

class ProjectUpdateIn(BaseModel):
    note: str

class MessageCreate(BaseModel):
    recipient_id: str
    body: str = ""
    project_id: Optional[str] = None
    attachment_url: Optional[str] = None
    message_type: str = "text"
    duration_seconds: Optional[int] = None
    reply_to_id: Optional[str] = None

class ReplyPreview(BaseModel):
    id: str
    sender_id: str
    sender_name: Optional[str] = None
    body: str
    message_type: str
    attachment_url: Optional[str] = None
    is_deleted: bool = False

    class Config:
        from_attributes = True

class ReactionSummary(BaseModel):
    emoji: str
    count: int
    mine: bool
    user_names: list[str] = []

class MessageOut(BaseModel):
    id: str
    project_id: Optional[str] = None
    sender_id: str
    recipient_id: str
    body: str
    attachment_url: Optional[str] = None
    message_type: str = "text"
    duration_seconds: Optional[int] = None
    is_read: bool
    is_deleted: bool = False
    edited_at: Optional[datetime] = None
    created_at: datetime
    sender_name: Optional[str] = None
    reply_to: Optional[ReplyPreview] = None
    reactions: list[ReactionSummary] = []

    class Config:
        from_attributes = True

class ReactionCreate(BaseModel):
    emoji: str

class MessageEdit(BaseModel):
    body: str

class ThreadOut(BaseModel):
    project_id: str
    project_title: str
    other_user_id: str
    other_user_name: str
    last_message: str
    last_message_at: datetime
    unread_count: int
