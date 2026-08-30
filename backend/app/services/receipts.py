"""PDF receipt generation for wallet transactions (funding, release, refund),
branded per the admin-configured settings in app/services/platform_settings
(get_receipt_settings) — template choice, theme colors, font, logo, company
name/footer. Three templates (classic/modern/minimal), all reportlab canvas
drawing (no external font embedding — font choice maps to reportlab's
built-in base-14 fonts, which render everywhere with zero extra assets)."""

import io

import httpx
from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from app.models.wallet import WalletTransaction

_FONT_FAMILIES = {
    "sans": {"regular": "Helvetica", "bold": "Helvetica-Bold", "italic": "Helvetica-Oblique"},
    "serif": {"regular": "Times-Roman", "bold": "Times-Bold", "italic": "Times-Italic"},
    "mono": {"regular": "Courier", "bold": "Courier-Bold", "italic": "Courier-Oblique"},
}

_TYPE_LABELS = {"funding": "Escrow Funding Receipt", "release": "Payout Receipt", "refund": "Refund Receipt"}

def _naira(amount: float) -> str:
    return f"₦{amount:,.2f}"

def _safe_color(hex_value: str, fallback):
    try:
        return HexColor(hex_value)
    except Exception:
        return fallback

def _fetch_logo(logo_url: str | None) -> ImageReader | None:
    if not logo_url:
        return None
    try:
        resp = httpx.get(logo_url, timeout=5)
        resp.raise_for_status()
        return ImageReader(io.BytesIO(resp.content))
    except Exception:

        return None

def _receipt_rows(tx: WalletTransaction) -> list[tuple[str, str]]:
    rows = [
        ("Receipt ID", tx.id),
        ("Date", tx.created_at.strftime("%d %b %Y, %H:%M UTC")),
        ("Status", tx.status.value.capitalize()),
        ("Type", tx.type.value.capitalize()),
        ("Project", tx.project.title if tx.project else "-"),
    ]
    if tx.platform_fee:
        rows.append(("Platform Fee", _naira(tx.platform_fee)))
    if tx.monnify_reference:
        rows.append(("Payment Reference", tx.monnify_reference))
    if tx.note:
        rows.append(("Note", tx.note))
    return rows

def _draw_modern(c: canvas.Canvas, tx: WalletTransaction, cfg: dict) -> None:
    width, height = A4
    fonts = _FONT_FAMILIES[cfg["font"]]
    primary = _safe_color(cfg["primary_color"], HexColor("#0f766e"))
    accent = _safe_color(cfg["accent_color"], black)

    band_h = 42 * mm
    c.setFillColor(primary)
    c.rect(0, height - band_h, width, band_h, stroke=0, fill=1)

    x = 20 * mm
    logo = _fetch_logo(cfg.get("logo_url"))
    text_x = x
    if logo:
        logo_size = 20 * mm
        c.drawImage(logo, x, height - band_h + (band_h - logo_size) / 2, width=logo_size, height=logo_size, mask="auto", preserveAspectRatio=True)
        text_x = x + logo_size + 6 * mm

    c.setFillColor(white)
    c.setFont(fonts["bold"], 18)
    c.drawString(text_x, height - 18 * mm, cfg["company_name"])
    c.setFont(fonts["regular"], 9)
    c.drawString(text_x, height - 24 * mm, cfg["tagline"])

    title = _TYPE_LABELS.get(tx.type.value, "Transaction Receipt")
    c.setFont(fonts["bold"], 12)
    c.drawRightString(width - x, height - 24 * mm, title)

    y = height - band_h - 16 * mm
    c.setFillColor(accent)
    c.setFont(fonts["regular"], 9)
    c.drawString(x, y, "AMOUNT")
    c.setFont(fonts["bold"], 26)
    c.setFillColor(primary)
    c.drawString(x, y - 12 * mm, _naira(tx.amount))

    y -= 26 * mm
    c.setStrokeColor(primary)
    c.setLineWidth(0.75)
    c.line(x, y, width - x, y)
    y -= 10 * mm

    c.setFillColor(accent)
    for label_text, value in _receipt_rows(tx):
        c.setFont(fonts["bold"], 10)
        c.drawString(x, y, f"{label_text}")
        c.setFont(fonts["regular"], 10)
        c.drawString(x + 55 * mm, y, str(value))
        y -= 7 * mm

    y -= 6 * mm
    c.setStrokeColor(HexColor("#e5e7eb"))
    c.line(x, y, width - x, y)
    y -= 8 * mm
    c.setFont(fonts["italic"], 8)
    c.setFillColor(HexColor("#6b7280"))
    c.drawString(x, y, cfg["footer_note"])

def _draw_classic(c: canvas.Canvas, tx: WalletTransaction, cfg: dict) -> None:
    width, height = A4
    fonts = _FONT_FAMILIES[cfg["font"]]
    primary = _safe_color(cfg["primary_color"], HexColor("#0f766e"))
    accent = _safe_color(cfg["accent_color"], black)
    x = 20 * mm
    y = height - 25 * mm

    logo = _fetch_logo(cfg.get("logo_url"))
    header_x = x
    if logo:
        logo_size = 14 * mm
        c.drawImage(logo, x, y - logo_size + 4 * mm, width=logo_size, height=logo_size, mask="auto", preserveAspectRatio=True)
        header_x = x + logo_size + 5 * mm

    c.setFillColor(primary)
    c.setFont(fonts["bold"], 16)
    c.drawString(header_x, y, cfg["company_name"])
    c.setFillColor(accent)
    c.setFont(fonts["regular"], 9)
    c.drawString(header_x, y - 14, cfg["tagline"])
    y -= 30

    c.setStrokeColor(primary)
    c.setLineWidth(1.5)
    c.line(x, y, width - x, y)
    y -= 16

    c.setFillColor(primary)
    c.setFont(fonts["bold"], 13)
    c.drawString(x, y, _TYPE_LABELS.get(tx.type.value, "Transaction Receipt"))
    y -= 20

    c.setFillColor(accent)
    c.setFont(fonts["regular"], 10)
    rows = [("Amount", _naira(tx.amount))] + _receipt_rows(tx)
    for i, (label_text, value) in enumerate(rows):
        if i % 2 == 1:
            c.setFillColor(HexColor("#f3f4f6"))
            c.rect(x - 2 * mm, y - 4, width - 2 * x + 4 * mm, 15, stroke=0, fill=1)
            c.setFillColor(accent)
        c.setFont(fonts["bold"], 10)
        c.drawString(x, y, f"{label_text}:")
        c.setFont(fonts["regular"], 10)
        c.drawString(x + 45 * mm, y, str(value))
        y -= 16

    y -= 10
    c.setFont(fonts["italic"], 8)
    c.setFillColor(HexColor("#6b7280"))
    c.drawString(x, y, cfg["footer_note"])

def _draw_minimal(c: canvas.Canvas, tx: WalletTransaction, cfg: dict) -> None:
    width, height = A4
    fonts = _FONT_FAMILIES[cfg["font"]]
    primary = _safe_color(cfg["primary_color"], HexColor("#0f766e"))
    accent = _safe_color(cfg["accent_color"], black)
    x = 25 * mm
    y = height - 30 * mm

    logo = _fetch_logo(cfg.get("logo_url"))
    if logo:
        logo_size = 10 * mm
        c.drawImage(logo, x, y - 2 * mm, width=logo_size, height=logo_size, mask="auto", preserveAspectRatio=True)
        c.setFont(fonts["bold"], 11)
        c.setFillColor(accent)
        c.drawString(x + logo_size + 4 * mm, y, cfg["company_name"])
    else:
        c.setFont(fonts["bold"], 11)
        c.setFillColor(accent)
        c.drawString(x, y, cfg["company_name"])

    c.setFont(fonts["regular"], 8)
    c.setFillColor(HexColor("#9ca3af"))
    c.drawRightString(width - x, y, tx.created_at.strftime("%d %b %Y, %H:%M UTC"))
    y -= 20

    c.setFont(fonts["regular"], 9)
    c.setFillColor(primary)
    c.drawString(x, y, _TYPE_LABELS.get(tx.type.value, "Transaction Receipt").upper())
    y -= 16
    c.setFont(fonts["bold"], 22)
    c.setFillColor(accent)
    c.drawString(x, y, _naira(tx.amount))
    y -= 20

    c.setStrokeColor(HexColor("#e5e7eb"))
    c.setLineWidth(0.5)
    c.line(x, y, width - x, y)
    y -= 12

    c.setFont(fonts["regular"], 9)
    for label_text, value in _receipt_rows(tx):
        c.setFillColor(HexColor("#9ca3af"))
        c.drawString(x, y, label_text)
        c.setFillColor(accent)
        c.drawRightString(width - x, y, str(value))
        y -= 13

    y -= 15
    c.setFont(fonts["italic"], 7.5)
    c.setFillColor(HexColor("#9ca3af"))
    c.drawString(x, y, cfg["footer_note"])

_TEMPLATES = {"modern": _draw_modern, "classic": _draw_classic, "minimal": _draw_minimal}

def build_transaction_receipt_pdf(tx: WalletTransaction, receipt_settings: dict | None = None) -> bytes:
    from app.schemas.receipt import ReceiptSettingsOut

    cfg = receipt_settings or ReceiptSettingsOut().model_dump()
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    draw_fn = _TEMPLATES.get(cfg.get("template", "modern"), _draw_modern)
    draw_fn(c, tx, cfg)
    c.showPage()
    c.save()
    return buf.getvalue()
