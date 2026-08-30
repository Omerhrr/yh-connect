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
    is_verified_business: bool = False
    kyc_status: str = "unverified"
    email_verified: bool = False
    wallet_balance: float = 0.0
    company_name: Optional[str] = None
    professional_tier: Optional[int] = None
    created_at: datetime
    suspended_until: Optional[datetime] = None
    suspension_reason: Optional[str] = None
    business_verification_status: str = "unverified"

    class Config:
        from_attributes = True

class SuspendUserRequest(BaseModel):

    duration_days: Optional[int] = None
    until_further_notice: bool = False
    forever: bool = False
    reason: Optional[str] = None

class AdminUserPatch(BaseModel):

    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None
    is_verified_business: Optional[bool] = None

class AdminWalletAdjust(BaseModel):
    amount: float
    note: Optional[str] = None

class AdminAnnouncement(BaseModel):
    title: str
    body: Optional[str] = None
    link: Optional[str] = None

class AdminProjectOut(BaseModel):
    id: str
    title: str
    status: ProjectStatus
    client_id: str
    client_name: Optional[str] = None
    assigned_professional_id: Optional[str] = None
    assigned_professional_name: Optional[str] = None
    bid_count: int = 0
    progress: float = 0.0
    budget_min: float
    budget_max: float
    created_at: datetime
    has_open_dispute: bool = False

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
    professional_count: int
    client_count: int
    active_projects: int
    total_projects: int
    completed_projects: int
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
    business_verification_status: str = "unverified"
    cac_number: Optional[str] = None
    cac_document_url: Optional[str] = None
    business_verification_note: Optional[str] = None
    suspended_until: Optional[datetime] = None
    suspension_reason: Optional[str] = None
    wallet_balance: float = 0.0
    created_at: datetime

    professional_profile: Optional[ProfessionalOut] = None
    bids: list[BidOut] = []

    projects: list[ProjectOut] = []

    class Config:
        from_attributes = True

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

class AdminProjectParty(BaseModel):
    id: str
    name: str
    email: str
    phone: Optional[str] = None
    is_active: bool = True

class AdminProjectFinancials(BaseModel):
    total_funded: float = 0.0
    total_released: float = 0.0
    total_refunded: float = 0.0
    in_escrow: float = 0.0
    platform_fees: float = 0.0

class AdminProjectDetailOut(BaseModel):
    project: ProjectOut
    client: Optional[AdminProjectParty] = None
    professional: Optional[AdminProjectParty] = None
    bids: list[BidOut] = []
    milestones: list[MilestoneOut] = []
    disputes: list[DisputeOut] = []
    financials: AdminProjectFinancials = AdminProjectFinancials()
    wallet_transactions: list[AdminWalletTransactionOut] = []

class AdminWalletSummary(BaseModel):
    total_funded: float
    total_released: float
    total_refunded: float
    total_in_escrow: float
    total_platform_fees: float
    total_topped_up: float = 0.0
    total_withdrawn: float = 0.0
    total_held_in_disputes: float = 0.0
    pending_transaction_count: int
    failed_transaction_count: int
    stuck_pending_count: int = 0

class AdminWalletTransactionsCount(BaseModel):
    total: int
