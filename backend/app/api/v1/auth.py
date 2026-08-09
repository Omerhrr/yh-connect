from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.limiter import limiter
from app.core.security import (
    create_access_token,
    generate_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.db.session import get_db
from app.models.auth_token import PasswordResetToken
from app.models.profile import ProfessionalProfile
from app.models.user import User, UserRole
from app.schemas.user import (
    BecomeTalentRequest,
    ChangePasswordRequest,
    ClientRegister,
    ForgotPasswordRequest,
    LoginRequest,
    ProfessionalRegister,
    ResetPasswordRequest,
    SwitchRoleRequest,
    Token,
    UserOut,
    UserSelfUpdate,
    VerifyEmailRequest,
)
from app.services.email import send_password_reset_email, send_verification_email, send_welcome_email

router = APIRouter(prefix="/auth", tags=["auth"])


def _issue_token(user: User) -> Token:
    token = create_access_token(user.id, {"role": user.role.value, "tv": user.token_version})
    return Token(access_token=token, user=UserOut.from_user(user))


def _start_email_verification(user: User, db: Session) -> None:
    token = generate_token()
    user.email_verification_token = token
    user.email_verification_sent_at = datetime.utcnow()
    db.commit()
    verify_url = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/verify-email?token={token}"
    send_verification_email(user.email, user.first_name, verify_url)


@router.post("/register/client", response_model=Token, status_code=201)
@limiter.limit("10/hour")
def register_client(request: Request, payload: ClientRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email.ilike(payload.email)).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        first_name=payload.first_name,
        last_name=payload.last_name,
        phone=payload.phone,
        role=UserRole.client,
        company_name=payload.company_name,
        industry=payload.industry,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    _start_email_verification(user, db)
    send_welcome_email(user.email, user.first_name)
    return _issue_token(user)


@router.post("/register/professional", response_model=Token, status_code=201)
@limiter.limit("10/hour")
def register_professional(request: Request, payload: ProfessionalRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email.ilike(payload.email)).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        first_name=payload.first_name,
        last_name=payload.last_name,
        phone=payload.phone,
        role=UserRole.professional,
    )
    db.add(user)
    db.flush()

    profile = ProfessionalProfile(
        user_id=user.id,
        title=payload.title,
        category_id=payload.category_id,
        bio=payload.bio,
        location=payload.location,
        hourly_rate=payload.hourly_rate,
        years_experience=payload.years_experience,
        skills=",".join(payload.skills) if payload.skills else None,
        license_number=payload.license_number,
    )
    db.add(profile)
    db.commit()
    db.refresh(user)
    _start_email_verification(user, db)
    send_welcome_email(user.email, user.first_name)
    return _issue_token(user)


@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email.ilike(payload.email)).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="This account has been disabled")
    return _issue_token(user)


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return UserOut.from_user(current_user)


@router.patch("/me", response_model=UserOut)
def update_me(
    payload: UserSelfUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return UserOut.from_user(current_user)


@router.post("/switch-role", response_model=Token)
def switch_role(
    payload: SwitchRoleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Flip an account's active mode between client and talent. Both sides
    of the account (client fields on the user row, professional profile in
    its own table) already coexist independently, so this never deletes or
    resets anything, it just changes which dashboard/gating applies."""
    if current_user.role == UserRole.admin or payload.target_role == UserRole.admin:
        raise HTTPException(status_code=400, detail="Admin accounts cannot switch roles")
    if payload.target_role == current_user.role:
        return _issue_token(current_user)
    if payload.target_role == UserRole.professional and current_user.profile is None:
        raise HTTPException(
            status_code=400,
            detail="Set up your professional profile first before switching to talent mode.",
        )
    current_user.role = payload.target_role
    db.commit()
    db.refresh(current_user)
    return _issue_token(current_user)


@router.post("/become-talent", response_model=Token, status_code=201)
def become_talent(
    payload: BecomeTalentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """One-step professional profile setup + switch into talent mode for an
    account that doesn't have one yet (e.g. an existing client wanting to
    also work as a professional). No new registration required."""
    if current_user.role == UserRole.admin:
        raise HTTPException(status_code=400, detail="Admin accounts cannot become talent")
    if current_user.profile is not None:
        raise HTTPException(status_code=409, detail="You already have a professional profile, use switch-role instead")

    profile = ProfessionalProfile(
        user_id=current_user.id,
        title=payload.title,
        category_id=payload.category_id,
        bio=payload.bio,
        location=payload.location,
        hourly_rate=payload.hourly_rate,
        years_experience=payload.years_experience,
        skills=",".join(payload.skills) if payload.skills else None,
        license_number=payload.license_number,
    )
    db.add(profile)
    current_user.role = UserRole.professional
    db.commit()
    db.refresh(current_user)
    return _issue_token(current_user)


@router.post("/forgot-password")
@limiter.limit("5/hour")
def forgot_password(request: Request, payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email.ilike(payload.email)).first()
    # Always return the same response whether or not the account exists, so
    # this endpoint can't be used to enumerate registered email addresses.
    if user:
        raw_token = generate_token()
        reset = PasswordResetToken(
            user_id=user.id,
            token_hash=hash_token(raw_token),
            expires_at=datetime.utcnow() + timedelta(hours=1),
        )
        db.add(reset)
        db.commit()
        reset_url = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/reset-password?token={raw_token}"
        send_password_reset_email(user.email, user.first_name, reset_url)
    return {"message": "If an account with that email exists, a reset link has been sent."}


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    token_hash = hash_token(payload.token)
    reset = db.query(PasswordResetToken).filter(PasswordResetToken.token_hash == token_hash).first()
    if (
        not reset
        or reset.used_at is not None
        or reset.expires_at < datetime.utcnow()
    ):
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired")

    user = db.get(User, reset.user_id)
    if not user:
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired")

    user.hashed_password = hash_password(payload.new_password)
    user.token_version += 1  # invalidate any tokens issued before the reset
    reset.used_at = datetime.utcnow()
    db.commit()
    return {"message": "Password reset successfully. Please log in with your new password."}


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.hashed_password = hash_password(payload.new_password)
    current_user.token_version += 1
    db.commit()
    return _issue_token(current_user)


@router.post("/logout-everywhere")
def logout_everywhere(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.token_version += 1
    db.commit()
    return _issue_token(current_user)


EMAIL_VERIFICATION_TOKEN_TTL_HOURS = 24


@router.post("/verify-email")
def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email_verification_token == payload.token).first()
    if not user:
        raise HTTPException(status_code=400, detail="This verification link is invalid or has expired")
    if (
        user.email_verification_sent_at
        and datetime.utcnow() - user.email_verification_sent_at > timedelta(hours=EMAIL_VERIFICATION_TOKEN_TTL_HOURS)
    ):
        raise HTTPException(status_code=400, detail="This verification link has expired. Request a new one from your account settings.")
    user.email_verified_at = datetime.utcnow()
    user.email_verification_token = None
    db.commit()
    return {"message": "Email verified."}


@router.post("/resend-verification")
def resend_verification(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.email_verified_at:
        return {"message": "Email already verified."}
    _start_email_verification(current_user, db)
    return {"message": "Verification email sent."}
