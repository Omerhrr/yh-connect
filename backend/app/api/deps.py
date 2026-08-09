from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import KycStatus, User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise credentials_exception
    user = db.get(User, payload["sub"])
    if not user or not user.is_active:
        raise credentials_exception
    if payload.get("tv", 0) != user.token_version:
        # Token was issued before a logout-everywhere / password change.
        raise credentials_exception
    return user


def require_role(*roles: UserRole):
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Not authorized for this action")
        return user

    return checker


def require_client_kyc_verified(user: User = Depends(require_role(UserRole.client))) -> User:
    """Gate for the points where a client can actually reach a specific
    professional (invite, message, accepting a bid), i.e. where a real
    working relationship, and potentially an in-person meeting, could start.
    Browsing and posting a project stay open without this."""
    if not settings.KYC_ENFORCEMENT_ENABLED:
        return user
    if user.kyc_status != KycStatus.verified:
        raise HTTPException(
            status_code=403,
            detail="Please verify your identity (NIN) before contacting professionals.",
        )
    return user
