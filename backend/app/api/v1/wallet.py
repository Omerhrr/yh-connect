import io

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role
from app.db.session import get_db
from app.models.milestone import Milestone, MilestoneStatus
from app.models.profile import ProfessionalProfile
from app.models.project import Project, ProjectStatus
from app.models.user import User, UserRole
from app.models.wallet import WalletTransaction, WalletTransactionStatus, WalletTransactionType
from app.models.notification import NotificationType
from app.schemas.wallet import (
    FundMilestoneRequest,
    FundMilestoneResponse,
    PayoutDetailsIn,
    WalletTopupRequest,
    WalletTopupResponse,
    WalletTransactionOut,
    WalletWithdrawRequest,
    WalletWithdrawResponse,
)
from app.services.disputes import has_blocking_dispute
from app.services.escrow import disburse_milestone, EscrowActionError
from app.services.monnify import monnify_client
from app.services.notify import notify
from app.services.platform_settings import get_platform_fee_percent

router = APIRouter(tags=["wallet"])


def _tx_out(tx: WalletTransaction) -> WalletTransactionOut:
    out = WalletTransactionOut.model_validate(tx)
    out.project_title = tx.project.title if tx.project else None
    return out


@router.post("/wallet/topup", response_model=WalletTopupResponse)
def topup_wallet(
    payload: WalletTopupRequest,
    current_user: User = Depends(require_role(UserRole.client)),
    db: Session = Depends(get_db),
):
    """Add funds to the client's prepaid escrow wallet via Monnify. Once
    credited, this balance is drawn down instantly when funding milestones,
    no separate checkout needed per milestone."""
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Enter an amount greater than zero")

    result = monnify_client.init_transaction(
        amount=payload.amount,
        customer_email=current_user.email,
        customer_name=f"{current_user.first_name} {current_user.last_name}",
        redirect_url=payload.redirect_url,
    )
    reference = result.get("transactionReference") or result.get("paymentReference")

    tx = WalletTransaction(
        project_id=None,
        milestone_id=None,
        client_id=current_user.id,
        professional_id=None,
        type=WalletTransactionType.topup,
        status=WalletTransactionStatus.pending,
        amount=payload.amount,
        monnify_reference=reference,
        note="Wallet top-up",
    )
    db.add(tx)

    # In local/simulated mode (no live Monnify keys) credit the wallet
    # immediately so the rest of the flow can be exercised end to end.
    if result.get("simulated"):
        tx.status = WalletTransactionStatus.successful
        current_user.wallet_balance += payload.amount

    db.commit()
    db.refresh(tx)
    db.refresh(current_user)

    return WalletTopupResponse(
        transaction_id=tx.id,
        monnify_reference=reference or "",
        checkout_url=result.get("checkoutUrl"),
        reserved_account=result.get("reservedAccount"),
        amount=payload.amount,
        wallet_balance=current_user.wallet_balance,
    )


@router.post("/wallet/withdraw", response_model=WalletWithdrawResponse)
def withdraw_wallet(
    payload: WalletWithdrawRequest,
    current_user: User = Depends(require_role(UserRole.professional)),
    db: Session = Depends(get_db),
):
    """Professional withdraws from their wallet balance to their bank
    account, on their own schedule, separate from when the payout landed."""
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Enter an amount greater than zero")
    if payload.amount > current_user.wallet_balance:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient wallet balance. You have ₦{current_user.wallet_balance:,.2f} available.",
        )

    profile = db.query(ProfessionalProfile).filter(ProfessionalProfile.user_id == current_user.id).first()
    if not profile or not profile.bank_code or not profile.bank_account_number:
        raise HTTPException(
            status_code=400,
            detail="Add your payout bank details before requesting a withdrawal.",
        )

    result = monnify_client.disburse(
        amount=payload.amount,
        bank_code=profile.bank_code,
        account_number=profile.bank_account_number,
        account_name=profile.bank_account_name or f"{current_user.first_name} {current_user.last_name}",
        narration="YH Connect wallet withdrawal",
    )

    current_user.wallet_balance -= payload.amount
    tx = WalletTransaction(
        project_id=None,
        milestone_id=None,
        client_id=None,
        professional_id=current_user.id,
        type=WalletTransactionType.withdrawal,
        status=WalletTransactionStatus.successful,
        amount=payload.amount,
        monnify_reference=result.get("reference"),
        note="Wallet withdrawal to bank account",
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    db.refresh(current_user)

    notify(
        db, current_user.id, NotificationType.general,
        f"₦{payload.amount:,.2f} withdrawal initiated",
        body=f"Your withdrawal to {profile.bank_account_name or 'your bank account'} is on its way.",
        link="/talent/dashboard/earnings", email_also=True,
    )

    return WalletWithdrawResponse(
        transaction_id=tx.id,
        amount=payload.amount,
        wallet_balance=current_user.wallet_balance,
        status=tx.status,
    )


@router.post("/milestones/{milestone_id}/fund", response_model=FundMilestoneResponse)
def fund_milestone(
    milestone_id: str,
    payload: FundMilestoneRequest,
    current_user: User = Depends(require_role(UserRole.client)),
    db: Session = Depends(get_db),
):
    milestone = db.get(Milestone, milestone_id)
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")
    project = milestone.project
    if project.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to fund this milestone")
    if milestone.status not in (MilestoneStatus.pending, MilestoneStatus.in_progress, MilestoneStatus.submitted):
        raise HTTPException(status_code=400, detail="Milestone is not in a fundable state")
    if has_blocking_dispute(db, project.id, milestone.id):
        raise HTTPException(status_code=400, detail="This milestone is under dispute and can't be funded until it's resolved")
    if current_user.wallet_balance < milestone.amount:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Insufficient wallet balance. You have ₦{current_user.wallet_balance:,.2f}, "
                f"need ₦{milestone.amount:,.2f}. Top up your wallet first."
            ),
        )

    current_user.wallet_balance -= milestone.amount
    tx = WalletTransaction(
        project_id=project.id,
        milestone_id=milestone.id,
        client_id=current_user.id,
        professional_id=project.assigned_professional_id,
        type=WalletTransactionType.funding,
        status=WalletTransactionStatus.successful,
        amount=milestone.amount,
        monnify_reference=None,
        note=f"Funded milestone '{milestone.title}' from wallet balance",
    )
    db.add(tx)
    milestone.status = MilestoneStatus.funded

    db.commit()
    db.refresh(tx)

    return FundMilestoneResponse(
        transaction_id=tx.id,
        monnify_reference="",
        checkout_url=None,
        reserved_account=None,
        amount=milestone.amount,
    )


@router.post("/webhooks/monnify")
async def monnify_webhook(request: Request, db: Session = Depends(get_db)):
    raw_body = await request.body()
    signature = request.headers.get("monnify-signature")
    if not monnify_client.verify_webhook_signature(raw_body, signature):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    import json as _json
    payload = _json.loads(raw_body)
    event_data = payload.get("eventData", payload)
    reference = event_data.get("transactionReference") or event_data.get("paymentReference")
    payment_status = (event_data.get("paymentStatus") or "").upper()

    if not reference:
        raise HTTPException(status_code=400, detail="Missing transaction reference")

    tx = db.query(WalletTransaction).filter(WalletTransaction.monnify_reference == reference).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Unknown transaction reference")

    if tx.status == WalletTransactionStatus.successful:
        return {"status": "already_processed"}

    if payment_status == "PAID":
        tx.status = WalletTransactionStatus.successful
        if tx.type == WalletTransactionType.topup:
            client = db.get(User, tx.client_id)
            if client:
                client.wallet_balance += tx.amount
                notify(
                    db, client.id, NotificationType.general,
                    f"₦{tx.amount:,.2f} added to your wallet",
                    body="Your wallet top-up was successful.",
                    link="/client/dashboard/payments", email_also=True,
                )
        elif tx.milestone_id:
            milestone = db.get(Milestone, tx.milestone_id)
            if milestone and milestone.status != MilestoneStatus.paid:
                milestone.status = MilestoneStatus.funded
                if milestone.project and milestone.project.assigned_professional_id:
                    notify(
                        db, milestone.project.assigned_professional_id, NotificationType.milestone_funded,
                        f"Milestone \"{milestone.title}\" was funded",
                        body="The client has funded this milestone. You can proceed with the work.",
                        link=f"/talent/dashboard/find-work/{milestone.project_id}", email_also=True,
                    )
    else:
        tx.status = WalletTransactionStatus.failed

    db.commit()
    return {"status": "ok"}


@router.post("/milestones/{milestone_id}/release", response_model=WalletTransactionOut)
def release_milestone_payout(
    milestone_id: str,
    current_user: User = Depends(require_role(UserRole.client)),
    db: Session = Depends(get_db),
):
    """Client approves a funded milestone -> disburse to the professional."""
    milestone = db.get(Milestone, milestone_id)
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")
    project = milestone.project
    if project.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if milestone.status not in (MilestoneStatus.funded, MilestoneStatus.approved):
        raise HTTPException(status_code=400, detail="Milestone must be funded before it can be released")
    if not project.assigned_professional_id:
        raise HTTPException(status_code=400, detail="No professional assigned to this project")
    if has_blocking_dispute(db, project.id, milestone.id):
        raise HTTPException(status_code=400, detail="This milestone is under dispute and its funds are on hold until it's resolved")

    try:
        tx = disburse_milestone(db, milestone, project, current_user.id, note=f"Payout for milestone '{milestone.title}'")
    except EscrowActionError as e:
        raise HTTPException(status_code=400, detail=str(e))
    db.commit()
    db.refresh(tx)
    return _tx_out(tx)


@router.get("/wallet/transactions", response_model=list[WalletTransactionOut])
def my_transactions(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(WalletTransaction)
    if current_user.role == UserRole.client:
        query = query.filter(WalletTransaction.client_id == current_user.id)
    else:
        query = query.filter(WalletTransaction.professional_id == current_user.id)
    txs = query.order_by(WalletTransaction.created_at.desc()).all()
    return [_tx_out(t) for t in txs]


@router.get("/wallet/transactions/{transaction_id}/receipt")
def download_receipt(transaction_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    tx = db.get(WalletTransaction, transaction_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if current_user.id not in (tx.client_id, tx.professional_id) and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    from app.services.receipts import build_transaction_receipt_pdf
    pdf_bytes = build_transaction_receipt_pdf(tx)
    filename = f"yh-connect-receipt-{tx.id[:8]}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.put("/professionals/me/payout-details")
def set_payout_details(
    payload: PayoutDetailsIn,
    current_user: User = Depends(require_role(UserRole.professional)),
    db: Session = Depends(get_db),
):
    profile = db.query(ProfessionalProfile).filter(ProfessionalProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    resolved = monnify_client.resolve_account_name(payload.bank_account_number, payload.bank_code)
    account_name = resolved.get("accountName", "")

    profile.bank_code = payload.bank_code
    profile.bank_account_number = payload.bank_account_number
    profile.bank_account_name = account_name
    db.commit()
    return {"bank_code": profile.bank_code, "bank_account_number": profile.bank_account_number, "bank_account_name": profile.bank_account_name}
