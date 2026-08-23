from typing import Optional

from pydantic import BaseModel


class VerificationSubmit(BaseModel):
    id_document_url: Optional[str] = None
    license_document_url: Optional[str] = None
    insurance_document_url: Optional[str] = None


class VerificationReview(BaseModel):
    status: str  # verified | rejected
    note: Optional[str] = None


class AddressVerificationSubmit(BaseModel):
    document_url: str


class AddressVerificationReview(BaseModel):
    status: str  # verified | rejected
    note: Optional[str] = None


class CertificationReview(BaseModel):
    status: str  # verified | rejected
    note: Optional[str] = None
    # Canonical badge label admin assigns on approval (e.g. "COREN", "ARCON",
    # "BSc", "HND", "CERT"). Only meaningful when status == "verified"; the
    # profile badge falls back to the submitted cert name if left blank.
    badge_name: Optional[str] = None


class BusinessVerificationSubmit(BaseModel):
    cac_number: str
    cac_document_url: str


class BusinessVerificationReview(BaseModel):
    status: str  # verified | rejected
    note: Optional[str] = None
