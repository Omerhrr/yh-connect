from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.dispute import DisputeCategory, DisputeOutcome, DisputeStatus, ProposalStatus

class ProposeResolution(BaseModel):
    outcome: DisputeOutcome
    split_professional_amount: Optional[float] = None
    note: Optional[str] = None

class RespondProposal(BaseModel):
    accept: bool
    note: Optional[str] = None

class DisputeCreate(BaseModel):
    project_id: str
    milestone_id: Optional[str] = None
    category: DisputeCategory = DisputeCategory.other
    reason: str
    evidence_urls: list[str] = []

class DisputeMessageCreate(BaseModel):
    body: str

class DisputeResolve(BaseModel):
    status: DisputeStatus
    outcome: Optional[DisputeOutcome] = None
    resolution_note: Optional[str] = None

    split_professional_amount: Optional[float] = None

class DisputeMessageOut(BaseModel):
    id: str
    sender_id: str
    sender_name: Optional[str] = None
    is_admin: bool = False
    body: str
    created_at: datetime

    class Config:
        from_attributes = True

class DisputeEventOut(BaseModel):
    id: str
    actor_id: Optional[str] = None
    actor_name: Optional[str] = None
    from_status: Optional[str] = None
    to_status: str
    note: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class DisputeOut(BaseModel):
    id: str
    project_id: str
    project_title: Optional[str] = None
    milestone_id: Optional[str] = None
    milestone_title: Optional[str] = None
    milestone_amount: Optional[float] = None
    milestone_status: Optional[str] = None
    category: DisputeCategory
    raised_by: str
    raised_by_name: Optional[str] = None
    other_party_id: Optional[str] = None
    other_party_name: Optional[str] = None
    reason: str
    evidence_urls: list[str] = []
    status: DisputeStatus
    outcome: Optional[DisputeOutcome] = None
    resolution_note: Optional[str] = None
    resolved_by_name: Optional[str] = None
    resolved_at: Optional[datetime] = None
    message_count: int = 0

    proposal_status: ProposalStatus = ProposalStatus.none
    proposed_outcome: Optional[DisputeOutcome] = None
    proposed_split_amount: Optional[float] = None
    proposed_by: Optional[str] = None
    proposed_by_name: Optional[str] = None
    proposal_note: Optional[str] = None
    proposal_expires_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class DisputeDetailOut(DisputeOut):
    messages: list[DisputeMessageOut] = []
    events: list[DisputeEventOut] = []
