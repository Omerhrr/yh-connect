from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.core.security import create_access_token, generate_token, hash_password
from app.db.session import get_db
from app.models.bid import Bid
from app.models.dispute import Dispute, DisputeStatus, BLOCKING_STATUSES
from app.models.milestone import Milestone, MilestoneStatus
from app.models.platform_setting import PlatformSetting
from app.models.profile import ProfessionalProfile
from app.models.project import Project, ProjectStatus
from app.models.user import User, UserRole
from app.models.notification import NotificationType
from app.models.wallet import WalletTransaction, WalletTransactionStatus, WalletTransactionType
from app.services.escrow import refund_milestone
from app.services.notify import notify
from app.schemas.admin import (
    AdminAnnouncement,
    AdminProjectDetailOut,
    AdminProjectFinancials,
    AdminProjectOut,
    AdminProjectParty,
    AdminRegister,
    AdminUserDetailOut,
    AdminUserOut,
    AdminUserPatch,
    SuspendUserRequest,
    AdminWalletAdjust,
    AdminWalletSummary,
    AdminWalletTransactionOut,
    AdminWalletTransactionsCount,
    AnalyticsOverview,
    PlatformSettingOut,
    PlatformSettingsPatch,
)
from app.schemas.dispute import DisputeDetailOut, DisputeOut
from app.services.disputes import build_dispute_detail_out, build_dispute_out
from app.schemas.receipt import ReceiptSettingsIn, ReceiptSettingsOut
from app.schemas.project_media import ProjectMediaSettingsIn, ProjectMediaSettingsOut
from app.services.platform_settings import (
    get_receipt_settings,
    save_receipt_settings,
    get_project_media_settings,
    save_project_media_settings,
)
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
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    query = db.query(User).filter(User.is_deleted.is_(False))
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
    limit = max(1, min(limit, 100))
    offset = max(0, offset)
    rows = query.order_by(User.created_at.desc()).offset(offset).limit(limit).all()
    from app.services.tiers import get_tier
    return [
        AdminUserOut(
            id=u.id,
            email=u.email,
            first_name=u.first_name,
            last_name=u.last_name,
            role=u.role,
            is_active=u.is_active,
            is_verified=u.is_verified,
            is_verified_business=u.is_verified_business,
            kyc_status=u.kyc_status.value,
            email_verified=u.email_verified_at is not None,
            wallet_balance=u.wallet_balance,
            company_name=u.company_name,
            professional_tier=get_tier(u, u.profile) if u.profile else None,
            created_at=u.created_at,
            suspended_until=u.suspended_until,
            suspension_reason=u.suspension_reason,
            business_verification_status=u.business_verification_status,
        )
        for u in rows
    ]


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
        business_verification_status=user.business_verification_status,
        cac_number=user.cac_number,
        cac_document_url=user.cac_document_url,
        business_verification_note=user.business_verification_note,
        suspended_until=user.suspended_until,
        suspension_reason=user.suspension_reason,
        wallet_balance=user.wallet_balance,
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
        else:
            # Manual unsuspend (or plain reactivate) clears any time-bound
            # suspension state so login stops showing a stale message.
            user.suspended_at = None
            user.suspended_until = None
            user.suspension_reason = None
    if payload.is_verified is not None:
        user.is_verified = payload.is_verified
    if payload.is_verified_business is not None:
        user.is_verified_business = payload.is_verified_business
        if payload.is_verified_business:
            notify(
                db, user.id, NotificationType.general,
                "Your business is now verified",
                body="Congratulations, your company now carries the Verified Business badge on YH Connect.",
                link="/client/dashboard/profile", email_also=True,
            )
    db.commit()
    db.refresh(user)
    return user


@router.post("/users/{user_id}/suspend", response_model=AdminUserOut)
def suspend_user(
    user_id: str,
    payload: SuspendUserRequest,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == UserRole.admin:
        raise HTTPException(status_code=400, detail="Can't suspend an admin account")
    if sum([bool(payload.duration_days), payload.until_further_notice, payload.forever]) != 1:
        raise HTTPException(status_code=400, detail="Choose exactly one: a number of days, \"until further notice\", or \"forever\"")

    if payload.forever:
        # "Forever" isn't a suspension state at all — the account is
        # deleted. We anonymize rather than hard-delete so the rows other
        # parties still depend on (their shared projects, milestones,
        # disputes, wallet transactions) keep their referential integrity
        # and history, but this account can never log in or be found again.
        user.is_active = False
        user.is_deleted = True
        user.deleted_at = datetime.utcnow()
        user.suspended_at = None
        user.suspended_until = None
        user.suspension_reason = payload.reason or "Account permanently deleted by admin"
        user.email = f"deleted+{user.id}@yhconnect.invalid"
        user.hashed_password = hash_password(generate_token())
        user.first_name = "Deleted"
        user.last_name = "User"
        user.phone = None
        user.username = None
        user.avatar_url = None
        user.company_name = None
        user.company_description = None
        user.company_website = None
        user.company_logo_url = None
        user.nin = None
        user.token_version += 1
        db.commit()
        return user

    user.is_active = False
    user.suspended_at = datetime.utcnow()
    user.suspension_reason = payload.reason
    user.suspended_until = (datetime.utcnow() + timedelta(days=payload.duration_days)) if payload.duration_days else None
    user.token_version += 1
    db.commit()
    db.refresh(user)

    duration_text = (
        f"for {payload.duration_days} day(s)" if payload.duration_days
        else "until further notice"
    )
    notify(
        db, user.id, NotificationType.general,
        "Your account has been suspended",
        body=f"Your account was suspended {duration_text}." + (f" Reason: {payload.reason}" if payload.reason else ""),
        email_also=True,
    )
    return user


@router.post("/users/{user_id}/unsuspend", response_model=AdminUserOut)
def unsuspend_user(
    user_id: str,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = True
    user.suspended_at = None
    user.suspended_until = None
    user.suspension_reason = None
    db.commit()
    db.refresh(user)
    notify(db, user.id, NotificationType.general, "Your account has been reinstated",
           body="Your account is active again — welcome back.", email_also=True)
    return user


@router.post("/users/{user_id}/wallet", response_model=AdminWalletTransactionOut)
def adjust_wallet(
    user_id: str,
    payload: AdminWalletAdjust,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    """Credit or debit a user's wallet balance directly (refunds, goodwill,
    corrections). A successful adjustment transaction is recorded so the
    change is visible in the user's own transaction history too."""
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if payload.amount == 0:
        raise HTTPException(status_code=400, detail="Amount must not be zero")
    if user.wallet_balance + payload.amount < 0:
        raise HTTPException(
            status_code=400,
            detail=f"Debit of {abs(payload.amount):.2f} exceeds the user's balance of {user.wallet_balance:.2f}",
        )

    user.wallet_balance += payload.amount
    tx = WalletTransaction(
        client_id=user.id if user.role == UserRole.client else None,
        professional_id=user.id if user.role == UserRole.professional else None,
        type=WalletTransactionType.adjustment,
        status=WalletTransactionStatus.successful,
        amount=abs(payload.amount),
        note=payload.note or ("Admin credit" if payload.amount > 0 else "Admin debit"),
    )
    db.add(tx)
    db.flush()
    direction = "credited to" if payload.amount > 0 else "debited from"
    notify(
        db, user.id, NotificationType.general,
        "Your wallet was updated by an administrator",
        body=f"₦{abs(payload.amount):,.2f} {direction} your wallet."
             + (f" ({payload.note})" if payload.note else ""),
        link="/wallet", email_also=True,
    )
    db.commit()
    db.refresh(tx)
    return _wallet_tx_to_out(tx, db)


@router.post("/announcements", status_code=201)
def send_announcement(
    payload: AdminAnnouncement,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    """Broadcast a notification to every active user on the platform."""
    if not payload.title.strip():
        raise HTTPException(status_code=400, detail="Title is required")
    users = db.query(User).filter(User.is_active.is_(True)).all()
    for u in users:
        notify(
            db, u.id, NotificationType.general,
            payload.title.strip(),
            body=payload.body,
            link=payload.link,
            email_also=True,
        )
    db.commit()
    return {"sent": len(users)}


# ─── Projects (oversight) ────────────────────────────────────────────────
def _admin_projects_query(db: Session, status_filter: ProjectStatus | None, q: str | None, has_dispute: bool | None):
    query = db.query(Project)
    if status_filter:
        query = query.filter(Project.status == status_filter)
    if q:
        like = f"%{q}%"
        matching_user_ids = db.query(User.id).filter(
            or_(User.first_name.ilike(like), User.last_name.ilike(like), User.email.ilike(like))
        )
        query = query.filter(
            or_(
                Project.title.ilike(like),
                Project.description.ilike(like),
                Project.location.ilike(like),
                Project.client_id.in_(matching_user_ids),
                Project.assigned_professional_id.in_(matching_user_ids),
            )
        )
    if has_dispute is not None:
        disputed_project_ids = db.query(Dispute.project_id).filter(Dispute.status.in_(BLOCKING_STATUSES))
        query = query.filter(Project.id.in_(disputed_project_ids)) if has_dispute else query.filter(Project.id.notin_(disputed_project_ids))
    return query


@router.get("/projects", response_model=list[AdminProjectOut])
def list_all_projects(
    status_filter: ProjectStatus | None = None,
    q: str | None = None,
    has_dispute: bool | None = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    limit = max(1, min(limit, 100))
    offset = max(0, offset)
    query = _admin_projects_query(db, status_filter, q, has_dispute)
    rows = query.order_by(Project.created_at.desc()).offset(offset).limit(limit).all()

    disputed_ids = {
        d.project_id
        for d in db.query(Dispute.project_id)
        .filter(Dispute.project_id.in_([p.id for p in rows]), Dispute.status.in_(BLOCKING_STATUSES))
        .all()
    }

    out: list[AdminProjectOut] = []
    for p in rows:
        client = db.get(User, p.client_id)
        pro = db.get(User, p.assigned_professional_id) if p.assigned_professional_id else None
        out.append(
            AdminProjectOut(
                id=p.id,
                title=p.title,
                status=p.status,
                client_id=p.client_id,
                client_name=f"{client.first_name} {client.last_name}" if client else None,
                assigned_professional_id=p.assigned_professional_id,
                assigned_professional_name=f"{pro.first_name} {pro.last_name}" if pro else None,
                bid_count=len(p.bids),
                progress=p.progress,
                budget_min=p.budget_min,
                budget_max=p.budget_max,
                created_at=p.created_at,
                has_open_dispute=p.id in disputed_ids,
            )
        )
    return out


@router.get("/projects/count")
def admin_projects_count(
    status_filter: ProjectStatus | None = None,
    q: str | None = None,
    has_dispute: bool | None = None,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    query = _admin_projects_query(db, status_filter, q, has_dispute)
    total = query.with_entities(func.count(Project.id)).scalar() or 0
    return {"total": total}


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
    txs = (
        db.query(WalletTransaction)
        .filter(WalletTransaction.project_id == project_id)
        .order_by(WalletTransaction.created_at.desc())
        .all()
    )

    client_user = db.get(User, project.client_id)
    client_party = (
        AdminProjectParty(
            id=client_user.id, name=f"{client_user.first_name} {client_user.last_name}",
            email=client_user.email, phone=client_user.phone, is_active=client_user.is_active,
        )
        if client_user else None
    )
    pro_user = db.get(User, project.assigned_professional_id) if project.assigned_professional_id else None
    pro_party = (
        AdminProjectParty(
            id=pro_user.id, name=f"{pro_user.first_name} {pro_user.last_name}",
            email=pro_user.email, phone=pro_user.phone, is_active=pro_user.is_active,
        )
        if pro_user else None
    )

    def sum_successful(tx_type: WalletTransactionType) -> float:
        return sum(t.amount for t in txs if t.type == tx_type and t.status == WalletTransactionStatus.successful)

    total_funded = sum_successful(WalletTransactionType.funding)
    total_released = sum_successful(WalletTransactionType.release)
    total_refunded = sum_successful(WalletTransactionType.refund)
    platform_fees = sum(t.platform_fee for t in txs if t.status == WalletTransactionStatus.successful)
    financials = AdminProjectFinancials(
        total_funded=total_funded,
        total_released=total_released,
        total_refunded=total_refunded,
        in_escrow=max(total_funded - total_released - total_refunded, 0.0),
        platform_fees=platform_fees,
    )

    return AdminProjectDetailOut(
        project=_project_to_out(project, db),
        client=client_party,
        professional=pro_party,
        bids=[_bid_to_out(b, db) for b in bids],
        milestones=list(milestones),
        disputes=list(disputes),
        financials=financials,
        wallet_transactions=[_wallet_tx_to_out(t, db) for t in txs],
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

    # Any escrowed money still sitting in a funded/approved milestone would
    # otherwise be stranded (still technically fundable/releasable on a
    # cancelled project via the normal endpoints). Refund it to the client
    # up front as part of the cancellation, same helper the normal
    # refund/dispute paths use, so it's a real, tracked wallet transaction.
    refunded_total = 0.0
    for milestone in project.milestones:
        if milestone.status in (MilestoneStatus.funded, MilestoneStatus.approved):
            refund_milestone(
                db, milestone, project, current_user.id,
                note=f"Refund: project '{project.title}' was cancelled by an administrator",
            )
            refunded_total += milestone.amount

    project.status = ProjectStatus.cancelled
    cancel_body = "An administrator cancelled this project. Contact support if you have questions."
    if refunded_total:
        cancel_body += f" ₦{refunded_total:,.2f} in escrowed milestone funds was refunded to your wallet."
    notify(
        db, project.client_id, NotificationType.general,
        f"Your project \"{project.title}\" was cancelled",
        body=cancel_body,
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


# ─── Receipt PDF branding ───────────────────────────────────────────────────
@router.get("/receipt-settings", response_model=ReceiptSettingsOut)
def get_receipt_settings_endpoint(
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    return ReceiptSettingsOut(**get_receipt_settings(db))


@router.put("/receipt-settings", response_model=ReceiptSettingsOut)
def update_receipt_settings_endpoint(
    payload: ReceiptSettingsIn,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    updated = save_receipt_settings(db, payload.model_dump(exclude_unset=True))
    return ReceiptSettingsOut(**updated)


@router.get("/project-media-settings", response_model=ProjectMediaSettingsOut)
def get_project_media_settings_endpoint(
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    return ProjectMediaSettingsOut(**get_project_media_settings(db))


@router.put("/project-media-settings", response_model=ProjectMediaSettingsOut)
def update_project_media_settings_endpoint(
    payload: ProjectMediaSettingsIn,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    updated = save_project_media_settings(db, payload.model_dump(exclude_unset=True))
    return ProjectMediaSettingsOut(**updated)


@router.get("/receipt-settings/preview")
def preview_receipt_settings(
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    """Renders a sample receipt with whatever's currently saved (or being
    tried out, via the same GET/PUT the settings form uses) so the admin can
    see the real PDF output before it goes live for every client/talent."""
    import io
    from datetime import datetime
    from types import SimpleNamespace
    from fastapi.responses import StreamingResponse
    from app.services.receipts import build_transaction_receipt_pdf

    sample = SimpleNamespace(
        id="sample-0000-0000-0000-000000000000",
        created_at=datetime.utcnow(),
        status=SimpleNamespace(value="successful"),
        type=SimpleNamespace(value="release"),
        project=SimpleNamespace(title="Sample Project — Perimeter Fence"),
        amount=47500.0,
        platform_fee=2500.0,
        monnify_reference="MNFY|SAMPLE|REF123456",
        note=None,
    )
    pdf_bytes = build_transaction_receipt_pdf(sample, get_receipt_settings(db))
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": 'inline; filename="receipt-preview.pdf"'},
    )


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
    # Pending Monnify topups/withdrawals that never got a webhook callback
    # within a reasonable window are effectively stuck and need admin eyes,
    # distinct from freshly-initiated ones still in flight.
    stuck_cutoff = datetime.utcnow() - timedelta(minutes=30)
    stuck_pending_count = (
        db.query(func.count(WalletTransaction.id))
        .filter(
            WalletTransaction.status == WalletTransactionStatus.pending,
            WalletTransaction.created_at < stuck_cutoff,
        )
        .scalar()
        or 0
    )
    # Money still sitting in escrow on milestones whose dispute is open /
    # under review / escalated: it's counted in total_in_escrow already, but
    # callers want to know how much of that is actually frozen vs. just
    # awaiting normal approval.
    held_milestone_ids = [
        d.milestone_id
        for d in db.query(Dispute.milestone_id)
        .filter(Dispute.status.in_(BLOCKING_STATUSES), Dispute.milestone_id.isnot(None))
        .all()
    ]
    total_held_in_disputes = 0.0
    if held_milestone_ids:
        total_held_in_disputes = (
            db.query(func.coalesce(func.sum(Milestone.amount), 0.0))
            .filter(Milestone.id.in_(held_milestone_ids))
            .scalar()
            or 0.0
        )

    return AdminWalletSummary(
        total_funded=total_funded,
        total_released=total_released,
        total_refunded=total_refunded,
        total_in_escrow=total_funded - total_released - total_refunded,
        total_platform_fees=total_platform_fees,
        total_topped_up=total_topped_up,
        total_withdrawn=total_withdrawn,
        total_held_in_disputes=total_held_in_disputes,
        pending_transaction_count=pending_count,
        failed_transaction_count=failed_count,
        stuck_pending_count=stuck_pending_count,
    )


def _wallet_query(
    db: Session,
    type_filter: WalletTransactionType | None,
    status_filter: WalletTransactionStatus | None,
    project_id: str | None,
    user_id: str | None,
    date_from: datetime | None,
    date_to: datetime | None,
    q: str | None,
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
    if date_from:
        query = query.filter(WalletTransaction.created_at >= date_from)
    if date_to:
        # Inclusive of the whole end day when only a date (no time) is given.
        query = query.filter(WalletTransaction.created_at <= date_to)
    if q:
        like = f"%{q.strip()}%"
        query = query.outerjoin(
            Project, Project.id == WalletTransaction.project_id
        ).filter(
            or_(
                WalletTransaction.monnify_reference.ilike(like),
                WalletTransaction.note.ilike(like),
                Project.title.ilike(like),
                WalletTransaction.client_id.in_(
                    db.query(User.id).filter(
                        or_(User.first_name.ilike(like), User.last_name.ilike(like), User.email.ilike(like))
                    )
                ),
                WalletTransaction.professional_id.in_(
                    db.query(User.id).filter(
                        or_(User.first_name.ilike(like), User.last_name.ilike(like), User.email.ilike(like))
                    )
                ),
            )
        )
    return query


@router.get("/wallet/transactions", response_model=list[AdminWalletTransactionOut])
def wallet_transactions(
    type_filter: WalletTransactionType | None = None,
    status_filter: WalletTransactionStatus | None = None,
    project_id: str | None = None,
    user_id: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    q: str | None = None,
    limit: int = 100,
    offset: int = 0,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    limit = max(1, min(limit, 500))
    offset = max(0, offset)
    query = _wallet_query(db, type_filter, status_filter, project_id, user_id, date_from, date_to, q)
    txs = (
        query.order_by(WalletTransaction.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [_wallet_tx_to_out(t, db) for t in txs]


@router.get("/wallet/transactions/count", response_model=AdminWalletTransactionsCount)
def wallet_transactions_count(
    type_filter: WalletTransactionType | None = None,
    status_filter: WalletTransactionStatus | None = None,
    project_id: str | None = None,
    user_id: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    q: str | None = None,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    """Total count matching the same filters as /wallet/transactions, so the
    admin UI can show "X of Y" and know when there's more to page through."""
    query = _wallet_query(db, type_filter, status_filter, project_id, user_id, date_from, date_to, q)
    total = query.with_entities(func.count(WalletTransaction.id)).scalar() or 0
    return AdminWalletTransactionsCount(total=total)


@router.get("/wallet/transactions/export")
def wallet_transactions_export(
    type_filter: WalletTransactionType | None = None,
    status_filter: WalletTransactionStatus | None = None,
    project_id: str | None = None,
    user_id: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    q: str | None = None,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    """CSV export of every transaction matching the current filters (not just
    the current page), for accounting/reconciliation outside the app."""
    import csv
    import io as _io
    from fastapi.responses import StreamingResponse

    query = _wallet_query(db, type_filter, status_filter, project_id, user_id, date_from, date_to, q)
    txs = query.order_by(WalletTransaction.created_at.desc()).limit(20000).all()

    buf = _io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "Date", "Type", "Status", "Amount", "Platform Fee", "Project", "Client", "Professional",
        "Monnify Reference", "Note", "Transaction ID",
    ])
    for t in txs:
        out = _wallet_tx_to_out(t, db)
        writer.writerow([
            out.created_at.isoformat(),
            out.type,
            out.status,
            f"{out.amount:.2f}",
            f"{out.platform_fee:.2f}",
            out.project_title or "",
            out.client_name or "",
            out.professional_name or "",
            out.monnify_reference or "",
            (out.note or "").replace("\n", " "),
            out.id,
        ])
    buf.seek(0)
    filename = f"yh-connect-transactions-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


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
    professional_count = (
        db.query(func.count(User.id)).filter(User.role == UserRole.professional).scalar() or 0
    )
    client_count = (
        db.query(func.count(User.id)).filter(User.role == UserRole.client).scalar() or 0
    )

    total_projects = db.query(func.count(Project.id)).scalar() or 0
    active_projects = (
        db.query(func.count(Project.id)).filter(Project.status == ProjectStatus.in_progress).scalar() or 0
    )
    completed_projects = (
        db.query(func.count(Project.id)).filter(Project.status == ProjectStatus.completed).scalar() or 0
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
        professional_count=professional_count,
        client_count=client_count,
        active_projects=active_projects,
        total_projects=total_projects,
        completed_projects=completed_projects,
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
    if db.query(User).filter(User.email.ilike(payload.email)).first():
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
    # Include the token_version claim like every other token issuer so the
    # usual logout-everywhere / password-change invalidation applies, and
    # use from_user so derived fields (email_verified etc.) are correct.
    token = create_access_token(user.id, {"role": user.role.value, "tv": user.token_version})
    return Token(access_token=token, user=UserOut.from_user(user))
