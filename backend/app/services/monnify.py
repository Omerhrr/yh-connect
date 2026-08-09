"""Thin wrapper around the Monnify API.

Docs: https://developers.monnify.com/

Flow used by this app:
  1. Client funds a milestone -> we call init_transaction() to get a hosted
     checkout URL (or reserved account details) and store the transaction
     reference on a WalletTransaction row (status=pending).
  2. Monnify sends a webhook to /webhooks/monnify when the transfer completes.
     We verify it, mark the WalletTransaction successful, and flip the
     milestone to `funded`.
  3. When the client approves a funded milestone, we call disburse() to pay
     the professional's bank account via the Disbursement API, recording a
     second WalletTransaction (type=release).

This wrapper degrades gracefully when MONNIFY_API_KEY/SECRET aren't configured
(local dev without real credentials): calls short-circuit into a "simulated"
response so the rest of the app (ledger, milestone status, UI) can be built
and tested without live Monnify credentials. Once real sandbox/live keys are
set in `.env`, these simulated branches stop firing automatically.
"""
import base64
import hashlib
import hmac
import time
import uuid
from typing import Any, Optional

import httpx

from app.core.config import settings


class MonnifyError(Exception):
    pass


class MonnifyClient:
    def __init__(self) -> None:
        self.base_url = settings.MONNIFY_BASE_URL.rstrip("/")
        self.api_key = settings.MONNIFY_API_KEY
        self.secret_key = settings.MONNIFY_SECRET_KEY
        self.contract_code = settings.MONNIFY_CONTRACT_CODE
        self._token: Optional[str] = None
        self._token_expires_at: float = 0.0

    @property
    def is_configured(self) -> bool:
        return settings.monnify_configured

    def verify_webhook_signature(self, raw_body: bytes, signature_header: Optional[str]) -> bool:
        """Monnify signs webhooks with a SHA512 HMAC of the raw request body,
        using the merchant secret key, sent in the `monnify-signature` header.
        In simulated/dev mode (no live keys configured) we skip verification
        so the local webhook simulator can exercise the flow; once real keys
        are set this becomes mandatory.
        """
        if not self.is_configured:
            return True
        if not signature_header:
            return False
        computed = hmac.new(
            self.secret_key.encode(), raw_body, hashlib.sha512
        ).hexdigest()
        return hmac.compare_digest(computed, signature_header)

    def _basic_auth_header(self) -> str:
        raw = f"{self.api_key}:{self.secret_key}".encode()
        return "Basic " + base64.b64encode(raw).decode()

    def _get_token(self) -> str:
        if self._token and time.time() < self._token_expires_at:
            return self._token
        resp = httpx.post(
            f"{self.base_url}/api/v1/auth/login",
            headers={"Authorization": self._basic_auth_header()},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()["responseBody"]
        self._token = data["accessToken"]
        # tokens are valid ~1hr; refresh a little early
        self._token_expires_at = time.time() + 55 * 60
        return self._token

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self._get_token()}"}

    def init_transaction(
        self,
        amount: float,
        customer_email: str,
        customer_name: str,
        payment_reference: Optional[str] = None,
        redirect_url: Optional[str] = None,
    ) -> dict[str, Any]:
        """Initialize a hosted checkout transaction for funding a milestone."""
        payment_reference = payment_reference or f"YHC-{uuid.uuid4().hex[:12]}"

        if not self.is_configured:
            # Simulated response for local dev without live Monnify keys.
            return {
                "simulated": True,
                "paymentReference": payment_reference,
                "transactionReference": f"SIM-{uuid.uuid4().hex[:16]}",
                "checkoutUrl": None,
            }

        body = {
            "amount": amount,
            "customerName": customer_name,
            "customerEmail": customer_email,
            "paymentReference": payment_reference,
            "paymentDescription": "YH Connect milestone funding",
            "currencyCode": "NGN",
            "contractCode": self.contract_code,
            "redirectUrl": redirect_url or "",
        }
        resp = httpx.post(
            f"{self.base_url}/api/v1/merchant/transactions/init-transaction",
            headers=self._headers(),
            json=body,
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        if not data.get("requestSuccessful"):
            raise MonnifyError(data.get("responseMessage", "Monnify init failed"))
        return data["responseBody"]

    def verify_transaction(self, transaction_reference: str) -> dict[str, Any]:
        if not self.is_configured:
            return {"simulated": True, "paymentStatus": "PAID"}
        resp = httpx.get(
            f"{self.base_url}/api/v2/transactions/{transaction_reference}",
            headers=self._headers(),
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("responseBody", {})

    def resolve_account_name(self, account_number: str, bank_code: str) -> dict[str, Any]:
        if not self.is_configured:
            return {"simulated": True, "accountName": "Simulated Account Holder"}
        resp = httpx.get(
            f"{self.base_url}/api/v1/disbursements/account/validate",
            params={"accountNumber": account_number, "bankCode": bank_code},
            headers=self._headers(),
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        if not data.get("requestSuccessful"):
            raise MonnifyError(data.get("responseMessage", "Account resolution failed"))
        return data["responseBody"]

    def disburse(
        self,
        amount: float,
        bank_code: str,
        account_number: str,
        account_name: str,
        reference: Optional[str] = None,
        narration: str = "YH Connect milestone payout",
    ) -> dict[str, Any]:
        reference = reference or f"YHC-PAYOUT-{uuid.uuid4().hex[:12]}"

        if not self.is_configured:
            return {
                "simulated": True,
                "reference": reference,
                "status": "SUCCESS",
            }

        body = {
            "amount": amount,
            "reference": reference,
            "narration": narration,
            "destinationBankCode": bank_code,
            "destinationAccountNumber": account_number,
            "currency": "NGN",
            "sourceAccountNumber": self.contract_code,
        }
        resp = httpx.post(
            f"{self.base_url}/api/v2/disbursements/single",
            headers=self._headers(),
            json=body,
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        if not data.get("requestSuccessful"):
            raise MonnifyError(data.get("responseMessage", "Disbursement failed"))
        return data["responseBody"]


monnify_client = MonnifyClient()
