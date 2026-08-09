from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.core.security import create_access_token, hash_password
from app.db.session import get_db
from app.models.bid import Bid
from app.models.dispute import Dispute, DisputeStatus
from app.models.milestone import Milestone
from app.models.platform_setting import PlatformSetting
from app.models.profile import ProfessionalProfile
from app.models.project import Project, ProjectStatus
from app.models.user import User, UserRole
from app.models.notification import NotificationType
from app.models.wallet import WalletTransaction, WalletTransactionStatus, WalletTransactionType
from app.services.notify import notify
from app.schemas.admin import (
    AdminProjectDetailOut,
    AdminProjectOut,
    AdminRegister,
    AdminUserDetailOut,
    AdminUserOut,
    AdminUserPatch,
    AdminWalletSummary,
    AdminWalletTransactionOut,
    AnalyticsOverview,
    PlatformSettingOut,
    PlatformSettingsPatch,
)
from app.schemas.dispute import DisputeDetailOut, DisputeOut
from app.services.disputes import build_dispute_detail_out, build_dispute_out
from app.schemas.user import Token, UserOut
from app.api.v1.bids import _to_out as _bid_to_out
from app.api.v1.professionals import _to_out as _profile_to_out
from app.api.v1.projects import _to_out as _project_to_out

router = APIRouter(prefix="/admin", tags=["admin"])


# ─── Disputes ──────────────────────────────────────────────────────────────
@router.get("/disputes", response_model=list[DisputeOut])
def list_disputes(
    status_filter: DisputeStatus | None = None,
    category_filter: str | None = None,
    q: str | None = None,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    query = db.query(Dispute)
    if status_filter:
        query = query.filter(Dispute.status == status_filter)
    if category_filter:
        query = query.filter(Dispute.category == category_filter)
    disputes = query.order_by(Dispute.created_at.desc()).all()
    out = [build_dispute_out(d, db) for d in disputes]
    if q:
        needle = q.lower()
        out = [
            d for d in out
            if needle in (d.project_title or "").lower()
            or needle in (d.raised_by_name or "").lower()
            or needle in d.reason.lower()
        ]
    return out


@router.get("/disputes/{dispute_id}", response_model=DisputeDetailOut)
def get_dispute_detail(
    dispute_id: str,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    dispute = db.get(Dispute, dispute_id)
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")
    return build_dispute_detail_out(dispute, db)


# ─── Users ─────────────────────────────────────────────────────────────────
@router.get("/users", response_model=list[AdminUserOut])
def list_users(
    role: UserRole | None = None,
    q: str | None = None,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    query = db.query(User)
    if role == UserRole.professional:
        # Show anyone with a professional profile, not just those currently
        # in talent mode, since dual-role accounts can be actively client-side.
        query = query.filter(
            or_(User.role == UserRole.professional, User.profile.has())
        )
    elif role == UserRole.client:
        query = query.filter(
            or_(User.role == UserRole.client, User.projects.any())
        )
    elif role:
        query = query.filter(User.role == role)
    if q:
        like = f"%{q}%"
        query = query.filter(
            (User.email.ilike(like)) | (User.first_name.ilike(like)) | (User.last_name.ilike(like))
        )
    return query.order_by(User.created_at.desc()).all()


@router.get("/users/{user_id}", response_model=AdminUserDetailOut)
def get_user_detail(
    user_id: str,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    professional_profile = None
    bids: list = []
    projects: list = []

    # Show both sides of a dual-role account, not just whichever mode is
    # currently active, so admins see the full picture of what a user does
    # on the platform.
    profile = db.query(ProfessionalProfile).filter(ProfessionalProfile.user_id == user.id).first()
    if profile:
        professional_profile = _profile_to_out(profile)
        bid_rows = db.query(Bid).filter(Bid.professional_id == user.id).order_by(Bid.created_at.desc()).all()
        bids = [_bid_to_out(b, db) for b in bid_rows]

    project_rows = db.query(Project).filter(Project.client_id == user.id).order_by(Project.created_at.desc()).all()
    if project_rows:
        projects = [_project_to_out(p, db) for p in project_rows]

    return AdminUserDetailOut(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        phone=user.phone,
        role=user.role,
        is_active=user.is_active,
        is_verified=user.is_verified,
        avatar_url=user.avatar_url,
        company_name=user.company_name,
        industry=user.industry,
        company_logo_url=user.company_logo_url,
        company_description=user.company_description,
        company_website=user.company_website,
        is_verified_business=user.is_verified_business,
        created_at=user.created_at,
        professional_profile=professional_profile,
        bids=bids,
        projects=projects,
    )


@router.patch("/users/{user_id}", response_model=AdminUserOut)
def update_user(
    user_id: str,
    payload: AdminUserPatch,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if payload.is_active is not None:
        user.is_active = payload.is_active
        if not payload.is_active:
            # Any outstanding tokens for this user stop working immediately
            # too (deps.py checks token_version), not just future logins.
            user.token_version += 1
    db.commit()
    db.refresh(user)
    return user


# ─── Projects (oversight) ────────────────────────────────────────────────
@router.get("/projects", response_model=list[AdminProjectOut])
def list_all_projects(
    status_filter: ProjectStatus | None = None,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    q = db.query(Project)
    if status_filter:
        q = q.filter(Project.status == status_filter)
    return q.order_by(Project.created_at.desc()).all()


@router.get("/projects/{project_id}", response_model=AdminProjectDetailOut)
def get_project_detail(
    project_id: str,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    bids = db.query(Bid).filter(Bid.project_id == project_id).order_by(Bid.created_at.desc()).all()
    milestones = db.query(Milestone).filter(Milestone.project_id == project_id).order_by(Milestone.sort_order).all()
    disputes = db.query(Dispute).filter(Dispute.project_id == project_id).order_by(Dispute.created_at.desc()).all()

    return AdminProjectDetailOut(
        project=_project_to_out(project, db),
        bids=[_bid_to_out(b, db) for b in bids],
        milestones=list(milestones),
        disputes=list(disputes),
    )


@router.patch("/projects/{project_id}/cancel", response_model=AdminProjectOut)
def force_cancel_project(
    project_id: str,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project.status = ProjectStatus.cancelled
    notify(
        db, project.client_id, NotificationType.general,
        f"Your project \"{project.title}\" was cancelled",
        body="An administrator cancelled this project. Contact support if you have questions.",
        link=f"/client/dashboard/projects/{project.id}", email_also=True,
    )
    if project.assigned_professional_id:
        notify(
            db, project.assigned_professional_id, NotificationType.general,
            f"Project \"{project.title}\" was cancelled",
            body="An administrator cancelled this project. Contact support if you have questions.",
            link=f"/talent/dashboard/find-work/{project.id}", email_also=True,
        )
    db.commit()
    db.refresh(project)
    return project


# ─── Platform settings ─────────────────────────────────────────────────────
@router.get("/settings", response_model=list[PlatformSettingOut])
def get_settings(
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    return db.query(PlatformSetting).order_by(PlatformSetting.key).all()


@router.patch("/settings", response_model=list[PlatformSettingOut])
def update_settings(
    payload: PlatformSettingsPatch,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    for key, value in payload.settings.items():
        setting = db.get(PlatformSetting, key)
        if setting:
            setting.value = value
        else:
            db.add(PlatformSetting(key=key, value=value, value_type="string"))
    db.commit()
    return db.query(PlatformSetting).order_by(PlatformSetting.key).all()


# ─── Wallet / escrow oversight ─────────────────────────────────────────────
def _wallet_tx_to_out(tx: WalletTransaction, db: Session) -> AdminWalletTransactionOut:
    client = db.get(User, tx.client_id) if tx.client_id else None
    professional = db.get(User, tx.professional_id) if tx.professional_id else None
    return AdminWalletTransactionOut(
        id=tx.id,
        project_id=tx.project_id,
        project_title=tx.project.title if tx.project else None,
        milestone_id=tx.milestone_id,
        client_id=tx.client_id,
        client_name=f"{client.first_name} {client.last_name}" if client else None,
        professional_id=tx.professional_id,
        professional_name=f"{professional.first_name} {professional.last_name}" if professional else None,
        type=tx.type.value,
        status=tx.status.value,
        amount=tx.amount,
        platform_fee=tx.platform_fee,
        monnify_reference=tx.monnify_reference,
        note=tx.note,
        created_at=tx.created_at,
    )


@router.get("/wallet/summary", response_model=AdminWalletSummary)
def wallet_summary(
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    def total_for(tx_type: WalletTransactionType) -> float:
        return (
            db.query(func.coalesce(func.sum(WalletTransaction.amount), 0.0))
            .filter(
                WalletTransaction.type == tx_type,
                WalletTransaction.status == WalletTransactionStatus.successful,
            )
            .scalar()
            or 0.0
        )

    total_funded = total_for(WalletTransactionType.funding)
    total_released = total_for(WalletTransactionType.release)
    total_refunded = total_for(WalletTransactionType.refund)
    total_topped_up = total_for(WalletTransactionType.topup)
    total_withdrawn = total_for(WalletTransactionType.withdrawal)
    total_platform_fees = (
        db.query(func.coalesce(func.sum(WalletTransaction.platform_fee), 0.0))
        .filter(WalletTransaction.status == WalletTransactionStatus.successful)
        .scalar()
        or 0.0
    )
    pending_count = (
        db.query(func.count(WalletTransaction.id))
        .filter(WalletTransaction.status == WalletTransactionStatus.pending)
        .scalar()
        or 0
    )
    failed_count = (
        db.query(func.count(WalletTransaction.id))
        .filter(WalletTransaction.status == WalletTransactionStatus.failed)
        .scalar()
        or 0
    )

    return AdminWalletSummary(
        total_funded=total_funded,
        total_released=total_released,
        total_refunded=total_refunded,
        total_in_escrow=total_funded - total_released - total_refunded,
        total_platform_fees=total_platform_fees,
        total_topped_up=total_topped_up,
        total_withdrawn=total_withdrawn,
        pending_transaction_count=pending_count,
        failed_transaction_count=failed_count,
    )


@router.get("/wallet/transactions", response_model=list[AdminWalletTransactionOut])
def wallet_transactions(
    type_filter: WalletTransactionType | None = None,
    status_filter: WalletTransactionStatus | None = None,
    project_id: str | None = None,
    user_id: str | None = None,
    limit: int = 100,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    query = db.query(WalletTransaction)
    if type_filter:
        query = query.filter(WalletTransaction.type == type_filter)
    if status_filter:
        query = query.filter(WalletTransaction.status == status_filter)
    if project_id:
        query = query.filter(WalletTransaction.project_id == project_id)
    if user_id:
        query = query.filter(
            (WalletTransaction.client_id == user_id) | (WalletTransaction.professional_id == user_id)
        )
    txs = query.order_by(WalletTransaction.created_at.desc()).limit(min(limit, 500)).all()
    return [_wallet_tx_to_out(t, db) for t in txs]


# ─── Analytics ──────────────────────────────────────────────────────────────
@router.get("/analytics/overview", response_model=AnalyticsOverview)
def analytics_overview(
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    total_users = db.query(func.count(User.id)).scalar() or 0
    signups_this_week = db.query(func.count(User.id)).filter(User.created_at >= week_ago).scalar() or 0
    signups_this_month = db.query(func.count(User.id)).filter(User.created_at >= month_ago).scalar() or 0

    total_projects = db.query(func.count(Project.id)).scalar() or 0
    active_projects = (
        db.query(func.count(Project.id)).filter(Project.status == ProjectStatus.in_progress).scalar() or 0
    )

    open_disputes = (
        db.query(func.count(Dispute.id)).filter(Dispute.status == DisputeStatus.open).scalar() or 0
    )
    pending_verifications = (
        db.query(func.count(ProfessionalProfile.id))
        .filter(ProfessionalProfile.verification_status == "pending")
        .scalar()
        or 0
    )

    gmv = (
        db.query(func.coalesce(func.sum(WalletTransaction.amount), 0.0))
        .filter(
            WalletTransaction.type == WalletTransactionType.funding,
            WalletTransaction.status == WalletTransactionStatus.successful,
        )
        .scalar()
        or 0.0
    )
    platform_revenue = (
        db.query(func.coalesce(func.sum(WalletTransaction.platform_fee), 0.0))
        .filter(WalletTransaction.status == WalletTransactionStatus.successful)
        .scalar()
        or 0.0
    )

    return AnalyticsOverview(
        signups_this_week=signups_this_week,
        signups_this_month=signups_this_month,
        total_users=total_users,
        active_projects=active_projects,
        total_projects=total_projects,
        open_disputes=open_disputes,
        pending_verifications=pending_verifications,
        gmv=gmv,
        platform_revenue=platform_revenue,
    )


# ─── Admin auth ─────────────────────────────────────────────────────────────
@router.post("/register", response_model=Token, status_code=201)
def register_admin(
    payload: AdminRegister,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        first_name=payload.first_name,
        last_name=payload.last_name,
        role=UserRole.admin,
        is_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(user.id, {"role": user.role.value})
    return Token(access_token=token, user=UserOut.model_validate(user))
