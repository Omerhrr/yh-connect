import json
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    PROJECT_NAME: str = "YH Connect API"
    API_V1_PREFIX: str = "/api/v1"

    # "development" (default, local/dev-friendly fallbacks are allowed) or
    # "production" (fail loudly at startup instead of silently running with
    # insecure defaults). Set ENV=production in the deployment environment.
    ENV: str = "development"

    DATABASE_URL: str = "sqlite:///./yhconnect.db"

    SECRET_KEY: str = "dev-secret-change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    BACKEND_CORS_ORIGINS: str = '["http://localhost:3000","http://127.0.0.1:3000"]'

    # File uploads (local disk for MVP; swap for S3/Cloudinary later)
    UPLOAD_DIR: str = "./uploads"
    PUBLIC_BASE_URL: str = "http://localhost:8000"

    # Monnify (payments)
    MONNIFY_BASE_URL: str = "https://sandbox.monnify.com"
    MONNIFY_API_KEY: str = ""
    MONNIFY_SECRET_KEY: str = ""
    MONNIFY_CONTRACT_CODE: str = ""
    MONNIFY_WEBHOOK_SECRET: str = ""
    PLATFORM_FEE_PERCENT: float = 5.0
    # Days a funded/approved milestone can sit "submitted, awaiting client
    # review" before it auto-releases to the professional. Protects the
    # professional from a client who's gone quiet after work is delivered,
    # mirroring Upwork's 14-day auto-release. Admin-editable at runtime via
    # /admin/settings (platform_settings key "milestone_auto_release_days"),
    # this is just the fallback.
    MILESTONE_AUTO_RELEASE_DAYS: float = 7.0
    # First-tier direct dispute resolution: how long the other party has to
    # respond to a proposed settlement before it auto-accepts, mirroring
    # Fiverr's 48-hour Resolution Center window. Admin-editable via
    # platform_settings key "dispute_direct_resolution_hours".
    DISPUTE_DIRECT_RESOLUTION_HOURS: float = 48.0
    # How long a user must wait after changing their first/last name before
    # they can change it again. The main reason: if an account is compromised,
    # an intruder's first move to redirect a withdrawal is often to rename the
    # profile to match a bank account they control. Slowing that down (and it
    # being visible/reversible by the real owner within the window) blunts the
    # attack. Admin-editable via platform_settings key
    # "profile_name_change_cooldown_hours".
    PROFILE_NAME_CHANGE_COOLDOWN_HOURS: float = 24.0

    # VerifyMe (client KYC, NIN identity verification, https://docs.verifyme.ng/)
    VERIFYME_BASE_URL: str = "https://vapi.verifyme.ng"
    VERIFYME_API_KEY: str = ""

    # Temporary kill switch while the rest of the platform is still being
    # built, set to true once ready to enforce KYC again on invites,
    # messages, and bid acceptance. The submit/verify endpoint and settings
    # UI stay fully functional either way; this only controls enforcement.
    KYC_ENFORCEMENT_ENABLED: bool = False

    # Talent tier system defaults (admin-editable at runtime via
    # /admin/settings, these are just the fallback until an admin sets
    # them). Tier 3 (NIN + address verified) is uncapped by design.
    TIER1_DAILY_PROPOSAL_LIMIT: int = 1
    TIER1_CONCURRENT_PROJECT_LIMIT: int = 1
    TIER2_DAILY_PROPOSAL_LIMIT: int = 10
    TIER2_CONCURRENT_PROJECT_LIMIT: int = 5

    # Transactional email (password reset, verification, notifications).
    # Leave unset for local dev: emails are logged to the console instead of
    # sent. Point these at any SMTP provider (SendGrid, Postmark, SES, etc.)
    # to send for real.
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_USE_TLS: bool = True
    EMAIL_FROM: str = "YH Connect <no-reply@yhconnect.ng>"

    # Base URL of the deployed frontend, used to build links in emails
    # (password reset, email verification).
    FRONTEND_BASE_URL: str = "http://localhost:3000"

    # Gates the one-off /api/v1/internal/seed bootstrap endpoint (see that
    # module for why it exists). Left blank by default so the endpoint fails
    # closed unless explicitly set in the environment.
    SEED_SECRET: str = ""

    @property
    def email_configured(self) -> bool:
        return bool(self.SMTP_HOST and self.SMTP_USER)

    @property
    def is_production(self) -> bool:
        return self.ENV.lower() in ("production", "prod")

    @property
    def cors_origins(self) -> List[str]:
        try:
            origins = json.loads(self.BACKEND_CORS_ORIGINS)
            if isinstance(origins, list) and origins:
                return origins
        except Exception:
            pass
        # Malformed/empty config used to silently fall back to ["*"], which
        # combined with allow_credentials=True is a wide-open, credentialed
        # CORS hole. Fail closed instead: no origins allowed until it's
        # configured correctly, rather than allowing every origin.
        return []

    @property
    def monnify_configured(self) -> bool:
        return bool(self.MONNIFY_API_KEY and self.MONNIFY_SECRET_KEY and self.MONNIFY_CONTRACT_CODE)

    @property
    def verifyme_configured(self) -> bool:
        return bool(self.VERIFYME_API_KEY)


settings = Settings()
