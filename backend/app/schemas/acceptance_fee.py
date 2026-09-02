from typing import Optional

from pydantic import BaseModel

class AcceptanceFeeRule(BaseModel):
    skill_level: Optional[str] = None  # "skilled" | "semi_skilled" | "unskilled" | None (any)
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    amount: float

class AcceptanceFeeSettingsOut(BaseModel):
    mode: str = "general"  # "general" | "rule_based"
    general_amount: float = 0.0
    rules: list[AcceptanceFeeRule] = []

class AcceptanceFeeSettingsUpdate(BaseModel):
    mode: Optional[str] = None
    general_amount: Optional[float] = None
    rules: Optional[list[AcceptanceFeeRule]] = None

class AcceptanceFeeQuoteOut(BaseModel):
    amount: float
    paid: bool
    wallet_balance: float

class AcceptanceFeePayResponse(BaseModel):
    transaction_id: str
    amount: float
    wallet_balance: float
