from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.core.limiter import limiter
from app.db.session import get_db
from app.models.project import Project, ProjectStatus
from app.models.user import KycStatus, User, UserRole
from app.models.wallet import WalletTransaction, WalletTransactionStatus, WalletTransactionType
from app.schemas.user import ClientProfileUpdate, ClientPublicOut, KycOut, KycSubmit, UserOut
from app.services.nin_verification import NinVerificationError, nin_verification_client
from app.services.username import is_username_taken, is_valid_username, normalize_username

router = APIRouter(prefix="/clients", tags=["clients"])


@router.patch("/me", response_model=UserOut)
def update_my_client_profile(
    payload: ClientProfileUpdate,
    current_user: User = Depends(require_role(UserRole.client)),
    db: Session = Depends(get_db),
):
    data = payload.model_dump(exclude_unset=True)
    if "username" in data and data["username"] is not None:
        username = normalize_username(data["username"])
        if not is_valid_username(username):
            raise HTTPException(
                status_code=400,
                detail="Usernames must be 3-20 characters, lowercase letters, numbers, and underscores only.",
            )
        if is_username_taken(db, username, exclude_user_id=current_user.id):
            raise HTTPException(status_code=409, detail="Username taken")
        data["username"] = username
    for field, value in data.items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    # UserOut.from_user rather than the raw ORM object: the response schema's
    # email_verified / has_professional_profile fields are derived (from
    # email_verified_at / profile), and model_validate alone leaves them at
    # their defaults, which would make the frontend briefly think the client
    # is unverified after every profile save.
    return UserOut.from_user(current_user)


@router.get("/me/kyc", response_model=KycOut)
def get_my_kyc(current_user: User = Depends(require_role(UserRole.client)), db: Session = Depends(get_db)):
    return KycOut(
        kyc_status=current_user.kyc_status,
        kyc_note=current_user.kyc_note,
        kyc_verified_at=current_user.kyc_verified_at,
    )


@router.post("/me/kyc", response_model=KycOut)
@limiter.limit("10/hour")
def submit_my_kyc(
    request: Request,
    payload: KycSubmit,
    current_user: User = Depends(require_role(UserRole.client)),
    db: Session = Depends(get_db),
):
    if current_user.kyc_status == KycStatus.verified:
        raise HTTPException(status_code=400, detail="Your identity is already verified")

    try:
        result = nin_verification_client.verify_nin(
            nin=payload.nin,
            first_name=current_user.first_name,
            last_name=current_user.last_name,
            dob=payload.dob,
        )
    except NinVerificationError as e:
        raise HTTPException(status_code=502, detail=f"Identity verification is temporarily unavailable: {e}")

    current_user.nin = payload.nin
    if result["verified"]:
        current_user.kyc_status = KycStatus.verified
        current_user.kyc_verified_at = datetime.utcnow()
        current_user.kyc_note = None
    else:
        current_user.kyc_status = KycStatus.rejected
        current_user.kyc_note = result["reason"]

    db.commit()
    db.refresh(current_user)
    return KycOut(
        kyc_status=current_user.kyc_status,
        kyc_note=current_user.kyc_note,
        kyc_verified_at=current_user.kyc_verified_at,
    )


def _client_public_out(client: User, db: Session) -> ClientPublicOut:
    completed_count = (
        db.query(Project)
        .filter(Project.client_id == client.id, Project.status == ProjectStatus.completed)
        .count()
    )
    open_count = (
        db.query(Project)
        .filter(Project.client_id == client.id, Project.status == ProjectStatus.open)
        .count()
    )
    total_count = db.query(Project).filter(Project.client_id == client.id).count()
    hire_rate = None
    if total_count > 0:
        hired_count = (
            db.query(Project)
            .filter(
                Project.client_id == client.id,
                Project.status.in_([ProjectStatus.in_progress, ProjectStatus.review, ProjectStatus.completed]),
            )
            .count()
        )
        hire_rate = round((hired_count / total_count) * 100)
    payment_verified = (
        db.query(WalletTransaction)
        .filter(
            WalletTransaction.client_id == client.id,
            WalletTransaction.type == WalletTransactionType.funding,
            WalletTransaction.status == WalletTransactionStatus.successful,
        )
        .first()
        is not None
    )
    return ClientPublicOut(
        id=client.id,
        first_name=client.first_name,
        last_name=client.last_name,
        company_name=client.company_name,
        company_logo_url=client.company_logo_url,
        company_description=client.company_description,
        company_website=client.company_website,
        industry=client.industry,
        is_verified_business=client.is_verified_business,
        kyc_verified=client.kyc_status == KycStatus.verified,
        payment_verified=payment_verified,
        completed_project_count=completed_count,
        open_project_count=open_count,
        hire_rate=hire_rate,
        member_since=client.created_at,
        preferred_categories=client.preferred_categories,
    )


@router.get("/{client_id}", response_model=ClientPublicOut)
def get_client_public(client_id: str, db: Session = Depends(get_db)):
    client = db.get(User, client_id)
    # Dual-role accounts can be actively in talent mode but still have a
    # client history, so don't gate strictly on the currently active role.
    has_client_history = client and db.query(Project).filter(Project.client_id == client_id).first() is not None
    if not client or (client.role != UserRole.client and not has_client_history):
        raise HTTPException(status_code=404, detail="Client not found")
    return _client_public_out(client, db)
