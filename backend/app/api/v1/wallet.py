import io

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role
from app.db.session import get_db
from app.models.milestone import Milestone, MilestoneStatus
from app.models.payout_account import PayoutAccount
from app.models.profile import ProfessionalProfile
from app.models.project import Project, ProjectStatus
from app.models.user import User, UserRole
from app.models.wallet import WalletTransaction, WalletTransactionStatus, WalletTransactionType
from app.models.notification import NotificationType
from app.schemas.wallet import (
    FundMilestoneRequest,
    FundMilestoneResponse,
    PayoutAccountCreate,
    PayoutAccountOut,
    WalletTopupRequest,
    WalletTopupResponse,
    WalletTransactionOut,
    WalletWithdrawRequest,
    WalletWithdrawResponse,
)
from app.services.disputes import has_blocking_dispute
from app.services.monnify import monnify_client
from app.services.notify import notify
from app.services.payout import names_match
from app.services.platform_settings import get_platform_fee_percent
from app.services.project_log import post_system_message

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

    try:
        result = monnify_client.init_transaction(
            amount=payload.amount,
            customer_email=current_user.email,
            customer_name=f"{current_user.first_name} {current_user.last_name}",
            redirect_url=payload.redirect_url,
        )
    except Exception as e:
        # MonnifyError and httpx transport errors (timeouts, DNS, 5xx)
        # land here too; surface a clean 400 instead of an unhandled 500.
        raise HTTPException(status_code=400, detail=f"Could not start payment: {e}")
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

    account = (
        db.query(PayoutAccount)
        .filter(PayoutAccount.professional_id == current_user.id, PayoutAccount.is_default.is_(True))
        .first()
    )
    if not account:
        raise HTTPException(
            status_code=400,
            detail="Add and select a payout bank account before requesting a withdrawal.",
        )
    # The core protection against a compromised account being drained to an
    # attacker's bank account: the resolved account holder name has to
    # plausibly be this professional, checked when the account was added.
    if not account.name_match:
        raise HTTPException(
            status_code=400,
            detail=(
                f"This account is registered to \"{account.account_name}\", which doesn't match your profile "
                f"name. For your security, withdrawals are blocked to accounts that don't match your name — "
                f"add an account in your own name, or contact support if this is genuinely yours."
            ),
        )

    try:
        result = monnify_client.disburse(
            amount=payload.amount,
            bank_code=account.bank_code,
            account_number=account.account_number,
            account_name=account.account_name,
            narration="YH Connect wallet withdrawal",
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not process the withdrawal: {e}")

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
        body=f"Your withdrawal to {account.account_name} is on its way.",
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
    post_system_message(db, project, current_user.id, f"💰 Milestone \"{milestone.title}\" funded — ₦{milestone.amount:,.2f} in escrow.")

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
    try:
        payload = _json.loads(raw_body)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid JSON body")
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


# Note: milestone payout release used to be a separate manual step here
# (POST /milestones/{id}/release). It's now folded into approving the
# milestone itself — see approve_milestone in api/v1/milestones.py, which
# disburses funds the instant the client approves, using the same
# disburse_milestone() escrow helper this endpoint used to call.


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
    from app.services.platform_settings import get_receipt_settings
    pdf_bytes = build_transaction_receipt_pdf(tx, get_receipt_settings(db))
    filename = f"yh-connect-receipt-{tx.id[:8]}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/professionals/me/payout-accounts", response_model=list[PayoutAccountOut])
def list_payout_accounts(current_user: User = Depends(require_role(UserRole.professional)), db: Session = Depends(get_db)):
    return (
        db.query(PayoutAccount)
        .filter(PayoutAccount.professional_id == current_user.id)
        .order_by(PayoutAccount.is_default.desc(), PayoutAccount.created_at.desc())
        .all()
    )


@router.post("/professionals/me/payout-accounts", response_model=PayoutAccountOut, status_code=201)
def add_payout_account(
    payload: PayoutAccountCreate,
    current_user: User = Depends(require_role(UserRole.professional)),
    db: Session = Depends(get_db),
):
    """Add a bank account a professional can withdraw to. Multiple accounts
    are allowed (e.g. personal + business), each independently name-checked
    against the professional's own account name — see app/services/payout.py
    for why, and wallet.py withdraw for where mismatches get blocked."""
    existing = (
        db.query(PayoutAccount)
        .filter(
            PayoutAccount.professional_id == current_user.id,
            PayoutAccount.bank_code == payload.bank_code,
            PayoutAccount.account_number == payload.account_number,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="This bank account has already been added")

    try:
        resolved = monnify_client.resolve_account_name(payload.account_number, payload.bank_code)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not verify this bank account: {e}")
    account_name = resolved.get("accountName", "")
    if not account_name:
        raise HTTPException(status_code=400, detail="Could not resolve an account name for these details, double-check the account number and bank")

    is_first = (
        db.query(PayoutAccount).filter(PayoutAccount.professional_id == current_user.id).first() is None
    )
    account = PayoutAccount(
        professional_id=current_user.id,
        bank_code=payload.bank_code,
        bank_name=payload.bank_name,
        account_number=payload.account_number,
        account_name=account_name,
        name_match=names_match(f"{current_user.first_name} {current_user.last_name}", account_name),
        is_default=is_first,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


@router.patch("/professionals/me/payout-accounts/{account_id}/default", response_model=PayoutAccountOut)
def set_default_payout_account(
    account_id: str,
    current_user: User = Depends(require_role(UserRole.professional)),
    db: Session = Depends(get_db),
):
    account = db.get(PayoutAccount, account_id)
    if not account or account.professional_id != current_user.id:
        raise HTTPException(status_code=404, detail="Payout account not found")
    db.query(PayoutAccount).filter(PayoutAccount.professional_id == current_user.id, PayoutAccount.id != account_id).update(
        {"is_default": False}
    )
    account.is_default = True
    db.commit()
    db.refresh(account)
    return account


@router.delete("/professionals/me/payout-accounts/{account_id}", status_code=204)
def delete_payout_account(
    account_id: str,
    current_user: User = Depends(require_role(UserRole.professional)),
    db: Session = Depends(get_db),
):
    account = db.get(PayoutAccount, account_id)
    if not account or account.professional_id != current_user.id:
        raise HTTPException(status_code=404, detail="Payout account not found")
    was_default = account.is_default
    db.delete(account)
    db.flush()
    if was_default:
        next_account = (
            db.query(PayoutAccount)
            .filter(PayoutAccount.professional_id == current_user.id)
            .order_by(PayoutAccount.created_at.desc())
            .first()
        )
        if next_account:
            next_account.is_default = True
    db.commit()
    return None
