"""NIN (National Identification Number) verification for client + professional
identity KYC, via Monnify's Verification API (the same provider already
integrated for payments — see app/services/monnify.py) rather than a separate
VerifyMe contract.

Flow used by this app:
  1. Client/professional submits their NIN + date of birth (dob currently
     unused by Monnify's NIN lookup, kept in the signature for API
     compatibility with callers and in case Monnify's response ever needs a
     dob cross-check added).
  2. We call verify_nin() -> Monnify looks up NIMC's record for that NIN and
     hands back whatever identity fields it has on file.
  3. We compare the first/last name we were given against what NIMC has on
     record ourselves (Monnify's endpoint returns the record, not a
     match/no-match verdict). A match sets kyc_status=verified immediately —
     an instant automated check, unlike the document-upload + admin-review
     flow used for professional license verification.

Degrades gracefully when Monnify isn't configured (local dev without live
credentials): validates NIN format only and simulates a successful match, so
the rest of the app (gating invites/messages/bid-acceptance on KYC) can be
built and tested end to end without live Monnify credentials or an active
NIN verification balance.
"""
import re
from typing import Any

from app.services.monnify import MonnifyError, monnify_client

NIN_PATTERN = re.compile(r"^\d{11}$")

class NinVerificationError(Exception):
    pass

def _names_match(claimed: str, on_file: str | None) -> bool:
    if not on_file:
        return False
    return claimed.strip().casefold() == on_file.strip().casefold()

class NinVerificationClient:
    @property
    def is_configured(self) -> bool:
        return monnify_client.is_configured

    def verify_nin(self, nin: str, first_name: str, last_name: str, dob: str) -> dict[str, Any]:
        """Returns {"verified": bool, "reason": str | None, "simulated": bool}."""
        if not NIN_PATTERN.match(nin):
            return {"verified": False, "reason": "NIN must be exactly 11 digits.", "simulated": not self.is_configured}

        try:
            record = monnify_client.verify_nin(nin)
        except MonnifyError as e:
            raise NinVerificationError(str(e))

        if record.get("simulated"):

            return {"verified": True, "reason": None, "simulated": True}

        if not record.get("found"):
            return {"verified": False, "reason": "NIN not found. Please double-check the number.", "simulated": False}

        on_file_first = record.get("firstName") or record.get("firstname") or record.get("first_name")
        on_file_last = record.get("lastName") or record.get("lastname") or record.get("surname") or record.get("last_name")

        if _names_match(first_name, on_file_first) and _names_match(last_name, on_file_last):
            return {"verified": True, "reason": None, "simulated": False}
        return {
            "verified": False,
            "reason": "The name on this NIN doesn't match the name on your account.",
            "simulated": False,
        }

nin_verification_client = NinVerificationClient()
