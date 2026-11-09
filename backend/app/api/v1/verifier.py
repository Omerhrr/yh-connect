"""External verifier portal.

Issuing bodies (ARCON, COREN, CORBON, ...) get their own logins so they can
help YH Connect approve the certificates they issued. This is intentionally
separate from user accounts and from the admin role:

- verifier tokens carry `typ=verifier` and only work on /verifier/* routes
  (regular user tokens don't work there, and vice versa);
- a verifier only ever sees certificates whose free-text `issuing_body`
  matches their own body, and can only mark those verified/rejected;
- every sign-off records which body and person made it.
Admins manage bodies and accounts under /admin/verifier-portal/*.
"""

import secrets
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.core.limiter import limiter
from app.core.security import create_access_token, decode_access_token, hash_password, verify_password
from app.db.session import get_db
from fastapi.security import OAuth2PasswordBearer

from app.models.certification import Certification
from app.models.notification import NotificationType
from app.models.user import User, UserRole
from app.models.verifier import IssuingBody, VerifierAccount
from app.services.notify import notify, notify_admins

router = APIRouter(tags=["verifier-portal"])

_verifier_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/verifier/login", auto_error=False)


# ---------------------------------------------------------------- auth

def get_current_verifier(
    token: str | None = Depends(_verifier_scheme),
    db: Session = Depends(get_db),
) -> VerifierAccount:
    err = HTTPException(status_code=401, detail="Could not validate credentials", headers={"WWW-Authenticate": "Bearer"})
    if not token:
        raise err
    payload = decode_access_token(token)
    if not payload or payload.get("typ") != "verifier" or "sub" not in payload:
        raise err
    account = db.get(VerifierAccount, payload["sub"])
    if not account or not account.is_active or not account.body or not account.body.is_active:
        raise err
    if payload.get("tv", 0) != account.token_version:
        raise err
    return account


class VerifierLogin(BaseModel):
    email: str
    password: str


class VerifierTokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    name: str
    body_name: str


@router.post("/verifier/login", response_model=VerifierTokenOut)
@limiter.limit("10/minute")
def verifier_login(request: Request, payload: VerifierLogin, db: Session = Depends(get_db)):
    account = db.query(VerifierAccount).filter(VerifierAccount.email.ilike(payload.email.strip())).first()
    if not account or not verify_password(payload.password, account.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if not account.is_active or not account.body.is_active:
        raise HTTPException(status_code=403, detail="This account has been deactivated")
    account.last_login_at = datetime.utcnow()
    db.commit()
    token = create_access_token(account.id, {"typ": "verifier", "tv": account.token_version})
    return VerifierTokenOut(access_token=token, name=account.name, body_name=account.body.name)


class VerifierMe(BaseModel):
    id: str
    name: str
    email: str
    body_name: str


@router.get("/verifier/me", response_model=VerifierMe)
def verifier_me(account: VerifierAccount = Depends(get_current_verifier)):
    return VerifierMe(id=account.id, name=account.name, email=account.email, body_name=account.body.name)


# ------------------------------------------------------ certificate review

def _matches(body: IssuingBody, cert: Certification) -> bool:
    issuer = (cert.issuing_body or "").strip().lower()
    if not issuer:
        return False
    return any(term and (term == issuer or term in issuer) for term in body.match_terms)


def _cert_out(c: Certification) -> dict:
    p = c.profile
    return {
        "id": c.id,
        "name": c.name,
        "issuing_body": c.issuing_body,
        "credential_url": c.credential_url,
        "issued_date": c.issued_date,
        "expiry_date": c.expiry_date,
        "submitted_at": c.created_at,
        "status": c.verification_status,
        "note": c.verification_note,
        "verified_by_body": c.verified_by_body,
        "verified_by_name": c.verified_by_name,
        # Only what's needed to check the credential: no email/phone/address.
        "holder_name": f"{p.user.first_name} {p.user.last_name}" if p and p.user else None,
        "holder_title": p.title if p else None,
        "holder_location": p.location if p else None,
    }


@router.get("/verifier/certifications")
def verifier_certifications(
    scope: str = "pending",
    account: VerifierAccount = Depends(get_current_verifier),
    db: Session = Depends(get_db),
):
    """scope=pending: awaiting review. scope=reviewed: sign-offs by this body."""
    query = db.query(Certification)
    if scope == "reviewed":
        query = query.filter(Certification.verified_by_body == account.body.name)
    else:
        query = query.filter(Certification.verification_status == "pending")
    certs = [c for c in query.order_by(Certification.created_at.desc()).all() if _matches(account.body, c)]
    return [_cert_out(c) for c in certs]


class VerifierDecision(BaseModel):
    status: str  # "verified" | "rejected"
    note: Optional[str] = None


@router.patch("/verifier/certifications/{certification_id}")
def verifier_review(
    certification_id: str,
    payload: VerifierDecision,
    account: VerifierAccount = Depends(get_current_verifier),
    db: Session = Depends(get_db),
):
    cert = db.get(Certification, certification_id)
    # Same 404 whether it doesn't exist or belongs to another body, so a
    # verifier can't probe for other bodies' records.
    if not cert or not _matches(account.body, cert):
        raise HTTPException(status_code=404, detail="Certification not found")
    if payload.status not in ("verified", "rejected"):
        raise HTTPException(status_code=400, detail="status must be 'verified' or 'rejected'")
    if payload.status == "rejected" and not (payload.note or "").strip():
        raise HTTPException(status_code=400, detail="Please say why it was rejected")
    if cert.verification_status not in ("pending", "verified", "rejected"):
        raise HTTPException(status_code=400, detail="This certificate hasn't been submitted for review")

    cert.verification_status = payload.status
    cert.verification_note = payload.note
    cert.verified_at = datetime.utcnow() if payload.status == "verified" else None
    cert.verified_by_body = account.body.name
    cert.verified_by_name = account.name
    if payload.status == "verified" and not cert.badge_name:
        cert.badge_name = cert.name

    user_id = cert.profile.user_id
    if payload.status == "verified":
        notify(
            db, user_id, NotificationType.kyc_status_changed,
            f'"{cert.name}" verified by {account.body.name}',
            body=f"{account.body.name} confirmed this credential. It now shows as a badge on your public profile.",
            link="/talent/dashboard/settings", email_also=True,
        )
    else:
        notify(
            db, user_id, NotificationType.kyc_status_changed,
            f'"{cert.name}" was not confirmed by {account.body.name}',
            body=payload.note or "Please review and resubmit.",
            link="/talent/dashboard/settings", email_also=True,
        )
    notify_admins(
        db, NotificationType.general,
        f"{account.body.name} {payload.status} a certificate",
        body=f"{cert.name} for {cert.profile.user.first_name} {cert.profile.user.last_name} ({account.name}).",
        link="/admin/verifier-portal", email_also=False,
    )
    db.commit()
    return {"status": cert.verification_status}


# ------------------------------------------------------------ admin side

class BodyCreate(BaseModel):
    name: str
    aliases: Optional[str] = None


class BodyUpdate(BaseModel):
    name: Optional[str] = None
    aliases: Optional[str] = None
    is_active: Optional[bool] = None


class AccountCreate(BaseModel):
    body_id: str
    name: str
    email: str


class AccountUpdate(BaseModel):
    is_active: Optional[bool] = None
    reset_password: bool = False


def _body_out(b: IssuingBody) -> dict:
    return {
        "id": b.id, "name": b.name, "aliases": b.aliases or "", "is_active": b.is_active,
        "account_count": len(b.accounts),
    }


def _account_out(a: VerifierAccount) -> dict:
    return {
        "id": a.id, "body_id": a.body_id, "body_name": a.body.name, "name": a.name,
        "email": a.email, "is_active": a.is_active, "last_login_at": a.last_login_at,
        "created_at": a.created_at,
    }


@router.get("/admin/verifier-portal/bodies")
def admin_list_bodies(current_user: User = Depends(require_role(UserRole.admin)), db: Session = Depends(get_db)):
    return [_body_out(b) for b in db.query(IssuingBody).order_by(IssuingBody.name).all()]


@router.post("/admin/verifier-portal/bodies", status_code=201)
def admin_create_body(payload: BodyCreate, current_user: User = Depends(require_role(UserRole.admin)), db: Session = Depends(get_db)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    if db.query(IssuingBody).filter(IssuingBody.name.ilike(name)).first():
        raise HTTPException(status_code=409, detail="That body already exists")
    b = IssuingBody(name=name, aliases=(payload.aliases or "").strip() or None)
    db.add(b)
    db.commit()
    db.refresh(b)
    return _body_out(b)


@router.patch("/admin/verifier-portal/bodies/{body_id}")
def admin_update_body(body_id: str, payload: BodyUpdate, current_user: User = Depends(require_role(UserRole.admin)), db: Session = Depends(get_db)):
    b = db.get(IssuingBody, body_id)
    if not b:
        raise HTTPException(status_code=404, detail="Not found")
    if payload.name is not None and payload.name.strip():
        b.name = payload.name.strip()
    if payload.aliases is not None:
        b.aliases = payload.aliases.strip() or None
    if payload.is_active is not None:
        b.is_active = payload.is_active
    db.commit()
    db.refresh(b)
    return _body_out(b)


@router.get("/admin/verifier-portal/accounts")
def admin_list_accounts(current_user: User = Depends(require_role(UserRole.admin)), db: Session = Depends(get_db)):
    return [_account_out(a) for a in db.query(VerifierAccount).order_by(VerifierAccount.created_at.desc()).all()]


@router.post("/admin/verifier-portal/accounts", status_code=201)
def admin_create_account(payload: AccountCreate, current_user: User = Depends(require_role(UserRole.admin)), db: Session = Depends(get_db)):
    body = db.get(IssuingBody, payload.body_id)
    if not body:
        raise HTTPException(status_code=404, detail="Issuing body not found")
    email = payload.email.strip().lower()
    if db.query(VerifierAccount).filter(VerifierAccount.email.ilike(email)).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    temp_password = secrets.token_urlsafe(9)
    a = VerifierAccount(body_id=body.id, name=payload.name.strip(), email=email, hashed_password=hash_password(temp_password))
    db.add(a)
    db.commit()
    db.refresh(a)
    # The temporary password is shown to the admin once, here, and never stored in clear.
    return {**_account_out(a), "temporary_password": temp_password}


@router.patch("/admin/verifier-portal/accounts/{account_id}")
def admin_update_account(account_id: str, payload: AccountUpdate, current_user: User = Depends(require_role(UserRole.admin)), db: Session = Depends(get_db)):
    a = db.get(VerifierAccount, account_id)
    if not a:
        raise HTTPException(status_code=404, detail="Not found")
    out_extra: dict = {}
    if payload.is_active is not None:
        a.is_active = payload.is_active
        if not payload.is_active:
            a.token_version += 1  # kicks out any live session
    if payload.reset_password:
        temp_password = secrets.token_urlsafe(9)
        a.hashed_password = hash_password(temp_password)
        a.token_version += 1
        out_extra["temporary_password"] = temp_password
    db.commit()
    db.refresh(a)
    return {**_account_out(a), **out_extra}
