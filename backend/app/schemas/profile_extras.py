from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class EmploymentHistoryCreate(BaseModel):
    title: str
    employer: str
    start_date: date
    end_date: Optional[date] = None  # None = present
    description: Optional[str] = None


class EmploymentHistoryOut(BaseModel):
    id: str
    profile_id: str
    title: str
    employer: str
    start_date: date
    end_date: Optional[date] = None
    description: Optional[str] = None

    class Config:
        from_attributes = True


class EducationCreate(BaseModel):
    school: str
    degree: Optional[str] = None
    field_of_study: Optional[str] = None
    start_year: Optional[int] = None
    end_year: Optional[int] = None


class EducationOut(BaseModel):
    id: str
    profile_id: str
    school: str
    degree: Optional[str] = None
    field_of_study: Optional[str] = None
    start_year: Optional[int] = None
    end_year: Optional[int] = None

    class Config:
        from_attributes = True


class CertificationCreate(BaseModel):
    name: str
    issuing_body: Optional[str] = None
    issued_date: Optional[date] = None
    expiry_date: Optional[date] = None
    credential_url: Optional[str] = None


class CertificationOut(BaseModel):
    id: str
    profile_id: str
    name: str
    issuing_body: Optional[str] = None
    issued_date: Optional[date] = None
    expiry_date: Optional[date] = None
    credential_url: Optional[str] = None

    class Config:
        from_attributes = True


class LanguageEntry(BaseModel):
    name: str
    level: str


class ProfessionalStats(BaseModel):
    total_projects: int = 0
    completed_projects: int = 0
    job_success_rate: Optional[int] = None  # None when not enough completed history yet
    member_since: datetime
    response_time_label: str = "New professional"


class WorkHistoryItem(BaseModel):
    project_id: str
    project_title: str
    client_name: str
    client_company: Optional[str] = None
    status: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    amount_range_label: str
    review_rating: Optional[int] = None
    review_comment: Optional[str] = None
