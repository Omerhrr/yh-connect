from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from app.models.project import ProjectStatus
from app.models.user import UserRole
from app.schemas.bid import BidOut
from app.schemas.dispute import DisputeOut
from app.schemas.milestone import MilestoneOut
from app.schemas.profile import ProfessionalOut
from app.schemas.project import ProjectOut


class AdminUserOut(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    role: UserRole
    is_active: bool
    is_verified: bool
    company_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AdminUserPatch(BaseModel):
    # Role is intentionally not editable here: swapping a user's role in
    # place (e.g. client -> professional) leaves orphaned data behind (a
    # professional has no ProfessionalProfile, a client's projects/wallet
    # rows stay tied to the old role) and isn't exposed in the admin UI.
    is_active: Optional[bool] = None


class AdminProjectOut(BaseModel):
    id: str
    title: str
    status: ProjectStatus
    client_id: str
    assigned_professional_id: Optional[str] = None
    budget_min: float
    budget_max: float
    created_at: datetime

    class Config:
        from_attributes = True


class PlatformSettingOut(BaseModel):
    key: str
    value: str
    value_type: str
    updated_at: datetime

    class Config:
        from_attributes = True


class PlatformSettingsPatch(BaseModel):
    settings: dict[str, str]


class AnalyticsOverview(BaseModel):
    signups_this_week: int
    signups_this_month: int
    total_users: int
    active_projects: int
    total_projects: int
    open_disputes: int
    pending_verifications: int
    gmv: float
    platform_revenue: float


class AdminRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    first_name: str
    last_name: str


class AdminUserDetailOut(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    phone: Optional[str] = None
    role: UserRole
    is_active: bool
    is_verified: bool
    avatar_url: Optional[str] = None
    company_name: Optional[str] = None
    industry: Optional[str] = None
    company_logo_url: Optional[str] = None
    company_description: Optional[str] = None
    company_website: Optional[str] = None
    is_verified_business: bool = False
    created_at: datetime
    # Present only for role == professional
    professional_profile: Optional[ProfessionalOut] = None
    bids: list[BidOut] = []
    # Present only for role == client
    projects: list[ProjectOut] = []

    class Config:
        from_attributes = True


class AdminProjectDetailOut(BaseModel):
    project: ProjectOut
    bids: list[BidOut] = []
    milestones: list[MilestoneOut] = []
    disputes: list[DisputeOut] = []


class AdminWalletTransactionOut(BaseModel):
    id: str
    project_id: Optional[str] = None
    project_title: Optional[str] = None
    milestone_id: Optional[str] = None
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    professional_id: Optional[str] = None
    professional_name: Optional[str] = None
    type: str
    status: str
    amount: float
    platform_fee: float
    monnify_reference: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AdminWalletSummary(BaseModel):
    total_funded: float
    total_released: float
    total_refunded: float
    total_in_escrow: float
    total_platform_fees: float
    total_topped_up: float = 0.0
    total_withdrawn: float = 0.0
    pending_transaction_count: int
    failed_transaction_count: int
