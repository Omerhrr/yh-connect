from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.wallet import WalletTransactionStatus, WalletTransactionType


class FundMilestoneRequest(BaseModel):
    redirect_url: Optional[str] = None


class FundMilestoneResponse(BaseModel):
    transaction_id: str
    monnify_reference: str
    checkout_url: Optional[str] = None
    reserved_account: Optional[dict] = None
    amount: float


class WalletTopupRequest(BaseModel):
    amount: float
    redirect_url: Optional[str] = None


class WalletTopupResponse(BaseModel):
    transaction_id: str
    monnify_reference: str
    checkout_url: Optional[str] = None
    reserved_account: Optional[dict] = None
    amount: float
    wallet_balance: float


class WalletWithdrawRequest(BaseModel):
    amount: float


class WalletWithdrawResponse(BaseModel):
    transaction_id: str
    amount: float
    wallet_balance: float
    status: WalletTransactionStatus


class WalletTransactionOut(BaseModel):
    id: str
    project_id: Optional[str] = None
    milestone_id: Optional[str] = None
    client_id: Optional[str] = None
    professional_id: Optional[str] = None
    type: WalletTransactionType
    status: WalletTransactionStatus
    amount: float
    platform_fee: float
    monnify_reference: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime
    project_title: Optional[str] = None

    class Config:
        from_attributes = True


class PayoutDetailsIn(BaseModel):
    bank_code: str
    bank_account_number: str
