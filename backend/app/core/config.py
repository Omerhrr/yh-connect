import json
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    PROJECT_NAME: str = "YH Connect API"
    API_V1_PREFIX: str = "/api/v1"

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

    # VerifyMe (client KYC, NIN identity verification, https://docs.verifyme.ng/)
    VERIFYME_BASE_URL: str = "https://vapi.verifyme.ng"
    VERIFYME_API_KEY: str = ""

    # Temporary kill switch while the rest of the platform is still being
    # built, set to true once ready to enforce KYC again on invites,
    # messages, and bid acceptance. The submit/verify endpoint and settings
    # UI stay fully functional either way; this only controls enforcement.
    KYC_ENFORCEMENT_ENABLED: bool = False

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

    @property
    def email_configured(self) -> bool:
        return bool(self.SMTP_HOST and self.SMTP_USER)

    @property
    def cors_origins(self) -> List[str]:
        try:
            return json.loads(self.BACKEND_CORS_ORIGINS)
        except Exception:
            return ["*"]

    @property
    def monnify_configured(self) -> bool:
        return bool(self.MONNIFY_API_KEY and self.MONNIFY_SECRET_KEY and self.MONNIFY_CONTRACT_CODE)

    @property
    def verifyme_configured(self) -> bool:
        return bool(self.VERIFYME_API_KEY)


settings = Settings()
