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
from app.models.category import Category
from app.models.profile import ProfessionalProfile
from app.models.user import User, UserRole
from app.services.platform_settings import get_profile_name_change_cooldown_hours
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
    UsernameAvailabilityOut,
    UsernameSuggestionsOut,
    UserSearchResult,
    UserSelfUpdate,
    VerifyEmailRequest,
)
from app.services.email import send_password_reset_email, send_verification_email, send_welcome_email
from app.services.username import is_username_taken, is_valid_username, normalize_username, suggest_usernames

router = APIRouter(prefix="/auth", tags=["auth"])

def _issue_token(user: User) -> Token:
    token = create_access_token(user.id, {"role": user.role.value, "tv": user.token_version})
    return Token(access_token=token, user=UserOut.from_user(user))

def _start_email_verification(user: User, db: Session) -> None:
    token = generate_token()

    user.email_verification_token = hash_token(token)
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
    if not db.get(Category, payload.category_id):
        raise HTTPException(status_code=400, detail="Unknown category")
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
    if user.is_deleted:
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if not user.is_active:

        if user.suspended_until and datetime.utcnow() >= user.suspended_until:
            user.is_active = True
            user.suspended_at = None
            user.suspended_until = None
            user.suspension_reason = None
            db.commit()
        else:
            if user.suspended_until:
                until_text = f"until {user.suspended_until.strftime('%B %d, %Y')}"
            else:
                until_text = "until further notice"
            reason_text = f" Reason: {user.suspension_reason}" if user.suspension_reason else ""
            raise HTTPException(
                status_code=403,
                detail=f"This account has been suspended {until_text}.{reason_text}",
            )
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
    name_changing = (
        ("first_name" in data and data["first_name"] != current_user.first_name)
        or ("last_name" in data and data["last_name"] != current_user.last_name)
    )
    if name_changing and current_user.name_changed_at:
        cooldown_hours = get_profile_name_change_cooldown_hours(db)
        elapsed = datetime.utcnow() - current_user.name_changed_at
        remaining = timedelta(hours=cooldown_hours) - elapsed
        if remaining.total_seconds() > 0:
            remaining_hours = max(remaining.total_seconds() / 3600, 0.1)
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Your name was changed recently. For account security (this slows down anyone who's "
                    f"compromised your account and is trying to rename it to match a bank account they control), "
                    f"you can change it again in about {remaining_hours:.1f} hour{'s' if remaining_hours >= 1.05 else ''}."
                ),
            )
    for field, value in data.items():
        setattr(current_user, field, value)
    if name_changing:
        current_user.name_changed_at = datetime.utcnow()
    db.commit()
    db.refresh(current_user)
    return UserOut.from_user(current_user)

@router.get("/username/suggestions", response_model=UsernameSuggestionsOut)
def username_suggestions(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return UsernameSuggestionsOut(suggestions=suggest_usernames(db, current_user.first_name, current_user.last_name))

@router.get("/username/check", response_model=UsernameAvailabilityOut)
def check_username(username: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    normalized = normalize_username(username)
    if not is_valid_username(normalized):
        return UsernameAvailabilityOut(
            username=normalized, available=False,
            reason="3-20 characters, lowercase letters, numbers, and underscores only.",
        )
    if is_username_taken(db, normalized, exclude_user_id=current_user.id):
        return UsernameAvailabilityOut(username=normalized, available=False, reason="Username taken")
    return UsernameAvailabilityOut(username=normalized, available=True)

@router.get("/users/search", response_model=list[UserSearchResult])
def search_users(q: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Look someone up by username — the point of having one. Requires
    login (same bar as browsing professionals/projects elsewhere in the
    app) so usernames aren't a public enumeration surface."""
    normalized = normalize_username(q).lstrip("@")
    if len(normalized) < 2:
        return []
    matches = (
        db.query(User)
        .filter(User.username.ilike(f"{normalized}%"), User.is_active.is_(True))
        .order_by(User.username)
        .limit(10)
        .all()
    )
    return [
        UserSearchResult(
            id=u.id,
            username=u.username,
            first_name=u.first_name,
            last_name=u.last_name,
            role=u.role,
            avatar_url=u.avatar_url,
            professional_profile_id=u.profile.id if u.profile else None,
        )
        for u in matches
    ]

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
    if not db.get(Category, payload.category_id):
        raise HTTPException(status_code=400, detail="Unknown category")

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
@limiter.limit("10/hour")
def reset_password(request: Request, payload: ResetPasswordRequest, db: Session = Depends(get_db)):
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
    user.token_version += 1
    reset.used_at = datetime.utcnow()
    db.commit()
    return {"message": "Password reset successfully. Please log in with your new password."}

@router.post("/change-password")
@limiter.limit("10/hour")
def change_password(
    request: Request,
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
@limiter.limit("20/hour")
def verify_email(request: Request, payload: VerifyEmailRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email_verification_token == hash_token(payload.token)).first()
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
@limiter.limit("5/hour")
def resend_verification(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.email_verified_at:
        return {"message": "Email already verified."}
    _start_email_verification(current_user, db)
    return {"message": "Verification email sent."}
