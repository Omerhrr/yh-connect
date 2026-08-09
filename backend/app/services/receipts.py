"""Simple PDF receipt generation for wallet transactions (funding, release,
refund), so clients and professionals have a downloadable document for their
own accounting/tax records."""

import io

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from app.models.wallet import WalletTransaction


def _naira(amount: float) -> str:
    return f"₦{amount:,.2f}"


def build_transaction_receipt_pdf(tx: WalletTransaction) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4
    x = 20 * mm
    y = height - 25 * mm

    c.setFont("Helvetica-Bold", 16)
    c.drawString(x, y, "YH Connect")
    c.setFont("Helvetica", 9)
    c.drawString(x, y - 14, "Nigeria's construction talent marketplace")
    y -= 30

    c.setFont("Helvetica-Bold", 13)
    label = {"funding": "Escrow Funding Receipt", "release": "Payout Receipt", "refund": "Refund Receipt"}.get(tx.type.value, "Transaction Receipt")
    c.drawString(x, y, label)
    y -= 20

    c.setFont("Helvetica", 10)
    rows = [
        ("Receipt ID", tx.id),
        ("Date", tx.created_at.strftime("%d %b %Y, %H:%M UTC")),
        ("Status", tx.status.value.capitalize()),
        ("Type", tx.type.value.capitalize()),
        ("Project", tx.project.title if tx.project else "-"),
        ("Amount", _naira(tx.amount)),
    ]
    if tx.platform_fee:
        rows.append(("Platform Fee", _naira(tx.platform_fee)))
    if tx.monnify_reference:
        rows.append(("Payment Reference", tx.monnify_reference))
    if tx.note:
        rows.append(("Note", tx.note))

    for label_text, value in rows:
        c.setFont("Helvetica-Bold", 10)
        c.drawString(x, y, f"{label_text}:")
        c.setFont("Helvetica", 10)
        c.drawString(x + 45 * mm, y, str(value))
        y -= 16

    y -= 10
    c.setFont("Helvetica-Oblique", 8)
    c.drawString(x, y, "This is a system-generated receipt from YH Connect and does not constitute a formal tax invoice.")

    c.showPage()
    c.save()
    return buf.getvalue()
