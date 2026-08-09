from typing import Optional

from pydantic import BaseModel


class VerificationSubmit(BaseModel):
    id_document_url: Optional[str] = None
    license_document_url: Optional[str] = None
    insurance_document_url: Optional[str] = None


class VerificationReview(BaseModel):
    status: str  # verified | rejected
    note: Optional[str] = None
