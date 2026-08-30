from typing import Literal, Optional

from pydantic import BaseModel

ReceiptTemplate = Literal["classic", "modern", "minimal"]
ReceiptFont = Literal["sans", "serif", "mono"]

class ReceiptSettingsOut(BaseModel):
    template: ReceiptTemplate = "modern"
    primary_color: str = "#0f766e"
    accent_color: str = "#111827"
    font: ReceiptFont = "sans"
    company_name: str = "YH Connect"
    tagline: str = "Nigeria's construction talent marketplace"
    logo_url: Optional[str] = None
    footer_note: str = "This is a system-generated receipt and does not constitute a formal tax invoice."

class ReceiptSettingsIn(BaseModel):
    template: Optional[ReceiptTemplate] = None
    primary_color: Optional[str] = None
    accent_color: Optional[str] = None
    font: Optional[ReceiptFont] = None
    company_name: Optional[str] = None
    tagline: Optional[str] = None
    logo_url: Optional[str] = None
    footer_note: Optional[str] = None
