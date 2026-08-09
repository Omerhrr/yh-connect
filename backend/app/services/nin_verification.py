"""NIN (National Identification Number) verification for client KYC, via
VerifyMe Nigeria (https://docs.verifyme.ng/identity-verifications/national-identification-number).

Flow used by this app:
  1. Client submits their NIN + date of birth via POST /clients/me/kyc
     (first/last name are taken from their account).
  2. We call verify_nin() -> POST /v1/verifications/identities/nin/{nin}
     with { firstname, lastname, dob } in the body and get back NIMC's
     record for that NIN plus a fieldMatches block telling us whether the
     name we supplied matches what's on file.
  3. A firstname+lastname match sets kyc_status=verified immediately, this
     is an instant automated check, unlike the document-upload + admin-review
     flow used for professional license verification.

Degrades gracefully when VERIFYME_API_KEY isn't set (local dev without a
VerifyMe contract): validates NIN format only and simulates a successful
match, so the rest of the app (gating invites/messages/bid-acceptance on
KYC) can be built and tested end to end. VerifyMe's own test key uses a
fixed test persona (NIN 10000000001 / John Doe / dob 04-04-1944), anything
else fails against their sandbox, so real testing against VerifyMe should
use that persona once a test key is added to `.env`.
"""
import re
from typing import Any

import httpx

from app.core.config import settings


class NinVerificationError(Exception):
    pass


NIN_PATTERN = re.compile(r"^\d{11}$")


def _to_verifyme_date(dob_iso: str) -> str:
    """Convert an ISO date (YYYY-MM-DD, from an HTML date input) to the
    DD-MM-YYYY format VerifyMe's sample requests use."""
    parts = dob_iso.split("-")
    if len(parts) == 3 and len(parts[0]) == 4:
        year, month, day = parts
        return f"{day}-{month}-{year}"
    return dob_iso


class NinVerificationClient:
    def __init__(self) -> None:
        self.base_url = settings.VERIFYME_BASE_URL.rstrip("/")
        self.api_key = settings.VERIFYME_API_KEY

    @property
    def is_configured(self) -> bool:
        return settings.verifyme_configured

    def verify_nin(self, nin: str, first_name: str, last_name: str, dob: str) -> dict[str, Any]:
        """Returns {"verified": bool, "reason": str | None, "simulated": bool}."""
        if not NIN_PATTERN.match(nin):
            return {"verified": False, "reason": "NIN must be exactly 11 digits.", "simulated": not self.is_configured}

        if not self.is_configured:
            # Simulated: any well-formed 11-digit NIN is treated as a match
            # so the KYC flow can be exercised without a live VerifyMe key.
            return {"verified": True, "reason": None, "simulated": True}

        resp = httpx.post(
            f"{self.base_url}/v1/verifications/identities/nin/{nin}",
            headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
            json={"firstname": first_name, "lastname": last_name, "dob": _to_verifyme_date(dob)},
            timeout=20,
        )

        if resp.status_code == 404:
            return {"verified": False, "reason": "NIN not found. Please double-check the number.", "simulated": False}

        if resp.status_code not in (200, 201):
            raise NinVerificationError(f"VerifyMe request failed with status {resp.status_code}: {resp.text[:300]}")

        data = resp.json()
        if data.get("status") != "success":
            raise NinVerificationError(data.get("message", "VerifyMe verification request failed"))

        record = data.get("data", {})
        matches = record.get("fieldMatches", {})
        # VerifyMe's own docs typo this key as "firsname" (missing a "t").
        first_matches = bool(matches.get("firsname") or matches.get("firstname"))
        last_matches = bool(matches.get("lastname"))

        if first_matches and last_matches:
            return {"verified": True, "reason": None, "simulated": False}
        return {
            "verified": False,
            "reason": "The name on this NIN doesn't match the name on your account.",
            "simulated": False,
        }


nin_verification_client = NinVerificationClient()
