"""Minimal transactional email sender.

Degrades gracefully when no provider is configured (local dev): instead of
sending, it logs the email to the console so the flow (password reset,
email verification, notifications) can be built and tested end to end
without a real mail provider.

Preferred provider is Resend (https://resend.com) — set RESEND_API_KEY in
`.env` and real emails go out via Resend's HTTPS API automatically, no code
changes needed. SMTP_HOST/SMTP_USER/SMTP_PASSWORD remains as a fallback
path (via stdlib smtplib) for any other SMTP-based provider, used only if
RESEND_API_KEY isn't set.
"""
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx

from app.core.config import settings

logger = logging.getLogger("yhconnect.email")

RESEND_API_URL = "https://api.resend.com/emails"


def _send_via_resend(to: str, subject: str, html_body: str, text_body: str | None) -> bool:
    payload = {
        "from": settings.EMAIL_FROM,
        "to": [to],
        "subject": subject,
        "html": html_body,
    }
    if text_body:
        payload["text"] = text_body
    try:
        resp = httpx.post(
            RESEND_API_URL,
            headers={
                "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=15,
        )
        if resp.status_code >= 400:
            logger.error("Resend send failed (%s) to %s: %s", resp.status_code, to, resp.text)
            return False
        return True
    except Exception:
        logger.exception("Failed to send email via Resend to %s", to)
        return False


def _send_via_smtp(to: str, subject: str, html_body: str, text_body: str | None) -> bool:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.EMAIL_FROM
    msg["To"] = to
    if text_body:
        msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            if settings.SMTP_USER:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.EMAIL_FROM, [to], msg.as_string())
        return True
    except Exception:
        logger.exception("Failed to send email via SMTP to %s", to)
        return False


def send_email(to: str, subject: str, html_body: str, text_body: str | None = None) -> bool:
    if not settings.email_configured:
        logger.info("[email:simulated] to=%s subject=%r\n%s", to, subject, text_body or html_body)
        return True

    if settings.RESEND_API_KEY:
        return _send_via_resend(to, subject, html_body, text_body)

    return _send_via_smtp(to, subject, html_body, text_body)


def _button(url: str, label: str) -> str:
    return (
        f'<a href="{url}" style="display:inline-block;background:#013156;color:#fff;'
        f'padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;">{label}</a>'
    )


def send_password_reset_email(to: str, first_name: str, reset_url: str) -> bool:
    html = f"""
    <p>Hi {first_name},</p>
    <p>We received a request to reset your YH Connect password. This link expires in 1 hour.</p>
    <p>{_button(reset_url, "Reset Password")}</p>
    <p>If you didn't request this, you can safely ignore this email.</p>
    """
    return send_email(to, "Reset your YH Connect password", html, f"Reset your password: {reset_url}")


def send_verification_email(to: str, first_name: str, verify_url: str) -> bool:
    html = f"""
    <p>Hi {first_name},</p>
    <p>Welcome to YH Connect. Please confirm your email address to activate your account.</p>
    <p>{_button(verify_url, "Verify Email")}</p>
    """
    return send_email(to, "Verify your YH Connect email", html, f"Verify your email: {verify_url}")


def send_welcome_email(to: str, first_name: str) -> bool:
    html = f"<p>Hi {first_name},</p><p>Welcome to YH Connect. Your account is ready to go.</p>"
    return send_email(to, "Welcome to YH Connect", html, "Welcome to YH Connect.")


def send_notification_email(to: str, first_name: str, title: str, body: str, link_url: str | None = None) -> bool:
    html = f"<p>Hi {first_name},</p><p><strong>{title}</strong></p><p>{body}</p>"
    if link_url:
        html += f"<p>{_button(link_url, 'View on YH Connect')}</p>"
    return send_email(to, title, html, body)
