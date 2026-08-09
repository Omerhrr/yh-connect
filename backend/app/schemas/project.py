from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.project import ProjectStatus, BudgetType
from app.schemas.category import CategoryOut


class ProjectCreate(BaseModel):
    title: str
    description: str
    category_id: str
    location: Optional[str] = None
    budget_min: float
    budget_max: float
    budget_type: BudgetType = BudgetType.fixed
    skills: list[str] = []


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ProjectStatus] = None
    progress: Optional[int] = None
    assigned_professional_id: Optional[str] = None


class ProjectOut(BaseModel):
    id: str
    client_id: str
    title: str
    description: str
    category: CategoryOut
    location: Optional[str] = None
    budget_min: float
    budget_max: float
    budget_type: BudgetType
    skills: list[str] = []
    status: ProjectStatus
    progress: int
    assigned_professional_id: Optional[str] = None
    created_at: datetime
    bid_count: int = 0
    client_company_name: Optional[str] = None
    client_is_verified_business: bool = False
    client_completed_project_count: int = 0
    client_kyc_verified: bool = False
    client_email_verified: bool = False
    client_member_since: Optional[datetime] = None
    client_open_project_count: int = 0
    client_hire_rate: Optional[int] = None

    class Config:
        from_attributes = True


class ProjectReportCreate(BaseModel):
    reason: str
    details: Optional[str] = None


class ProjectReportOut(BaseModel):
    id: str
    project_id: str
    reporter_id: str
    reason: str
    details: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
