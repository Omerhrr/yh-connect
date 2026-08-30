from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from app.models.user import KycStatus, UserRole

class UserBase(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    phone: Optional[str] = None

class ClientRegister(UserBase):
    password: str = Field(min_length=8)
    company_name: Optional[str] = None
    industry: Optional[str] = None

class ProfessionalRegister(UserBase):
    password: str = Field(min_length=8)
    title: str
    category_id: str
    bio: Optional[str] = None
    location: Optional[str] = None
    hourly_rate: Optional[float] = None
    years_experience: Optional[str] = None
    skills: list[str] = []
    license_number: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserOut(UserBase):
    id: str
    role: UserRole
    avatar_url: Optional[str] = None
    company_name: Optional[str] = None
    industry: Optional[str] = None
    company_logo_url: Optional[str] = None
    company_description: Optional[str] = None
    company_website: Optional[str] = None
    is_verified_business: bool = False
    business_verification_status: str = "unverified"
    preferred_categories: Optional[list[str]] = None
    is_verified: bool
    email_verified: bool = False
    kyc_status: KycStatus = KycStatus.unverified
    email_notifications_enabled: bool = True
    created_at: datetime
    wallet_balance: float = 0.0

    has_professional_profile: bool = False
    name_changed_at: Optional[datetime] = None
    username: Optional[str] = None

    class Config:
        from_attributes = True

    @staticmethod
    def from_user(user) -> "UserOut":
        out = UserOut.model_validate(user)
        out.email_verified = user.email_verified_at is not None
        out.has_professional_profile = user.profile is not None
        return out

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8)

class VerifyEmailRequest(BaseModel):
    token: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)

class SwitchRoleRequest(BaseModel):
    target_role: UserRole

class BecomeTalentRequest(BaseModel):
    """Quick professional-profile setup for an existing (client) account
    switching into talent mode for the first time. No password/email/name,
    those already exist on the account."""
    title: str
    category_id: str
    bio: Optional[str] = None
    location: Optional[str] = None
    hourly_rate: Optional[float] = None
    years_experience: Optional[str] = None
    skills: list[str] = []
    license_number: Optional[str] = None

class UserSelfUpdate(BaseModel):
    """Fields any authenticated user (client, professional, or admin) can edit about themselves."""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    email_notifications_enabled: Optional[bool] = None
    username: Optional[str] = None

class UsernameAvailabilityOut(BaseModel):
    username: str
    available: bool
    reason: Optional[str] = None

class UsernameSuggestionsOut(BaseModel):
    suggestions: list[str]

class UserSearchResult(BaseModel):
    id: str
    username: str
    first_name: str
    last_name: str
    role: UserRole
    avatar_url: Optional[str] = None
    professional_profile_id: Optional[str] = None

class ClientProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    username: Optional[str] = None
    company_name: Optional[str] = None
    industry: Optional[str] = None
    company_logo_url: Optional[str] = None
    company_description: Optional[str] = None
    company_website: Optional[str] = None
    preferred_categories: Optional[list[str]] = None

class KycSubmit(BaseModel):
    nin: str = Field(min_length=11, max_length=11)
    dob: str

    document_url: Optional[str] = None

class KycOut(BaseModel):
    kyc_status: KycStatus
    kyc_note: Optional[str] = None
    kyc_verified_at: Optional[datetime] = None

class ClientPublicOut(BaseModel):
    id: str
    first_name: str
    last_name: str
    company_name: Optional[str] = None
    company_logo_url: Optional[str] = None
    company_description: Optional[str] = None
    company_website: Optional[str] = None
    industry: Optional[str] = None
    is_verified_business: bool = False
    kyc_verified: bool = False

    payment_verified: bool = False
    completed_project_count: int = 0
    open_project_count: int = 0
    hire_rate: Optional[int] = None
    member_since: datetime
    preferred_categories: Optional[list[str]] = None

    class Config:
        from_attributes = True
