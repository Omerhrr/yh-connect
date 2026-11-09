from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.contract import ContractStatus

class ContractUpdate(BaseModel):
    content: str

class ContractOut(BaseModel):
    id: str
    project_id: str
    bid_id: Optional[str] = None
    client_id: str
    professional_id: str
    content: str
    status: ContractStatus
    client_approved: bool
    professional_approved: bool
    last_edited_by: Optional[str] = None
    version: int
    created_at: datetime
    updated_at: datetime
    approved_at: Optional[datetime] = None
    project_title: Optional[str] = None
    contract_type: str = "fixed"
    agreed_amount: Optional[float] = None
    milestone_total: Optional[float] = None
    amounts_tally: Optional[bool] = None

    class Config:
        from_attributes = True
