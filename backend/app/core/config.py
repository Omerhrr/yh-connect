import json
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    PROJECT_NAME: str = "YH Connect API"
    API_V1_PREFIX: str = "/api/v1"

    ENV: str = "development"

    DATABASE_URL: str = "sqlite:///./yhconnect.db"

    SECRET_KEY: str = "dev-secret-change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    BACKEND_CORS_ORIGINS: str = '["http://localhost:3000","http://127.0.0.1:3000"]'

    UPLOAD_DIR: str = "./uploads"
    PUBLIC_BASE_URL: str = "http://localhost:8000"

    MONNIFY_BASE_URL: str = "https://sandbox.monnify.com"
    MONNIFY_API_KEY: str = ""
    MONNIFY_SECRET_KEY: str = ""
    MONNIFY_CONTRACT_CODE: str = ""
    MONNIFY_WEBHOOK_SECRET: str = ""
    PLATFORM_FEE_PERCENT: float = 5.0

    MILESTONE_AUTO_RELEASE_DAYS: float = 7.0

    DISPUTE_DIRECT_RESOLUTION_HOURS: float = 48.0

    PROFILE_NAME_CHANGE_COOLDOWN_HOURS: float = 24.0

    PAYMENT_WITHHOLDING_PERCENT: float = 0.0
    PAYMENT_WITHHOLDING_RELEASE_DAYS: float = 7.0

    KYC_ENFORCEMENT_ENABLED: bool = False

    TIER1_DAILY_PROPOSAL_LIMIT: int = 1
    TIER1_CONCURRENT_PROJECT_LIMIT: int = 1
    TIER2_DAILY_PROPOSAL_LIMIT: int = 10
    TIER2_CONCURRENT_PROJECT_LIMIT: int = 5

    RESEND_API_KEY: str = ""
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_USE_TLS: bool = True
    EMAIL_FROM: str = "YH Connect <no-reply@yhconnect.ng>"

    FRONTEND_BASE_URL: str = "http://localhost:3000"

    SEED_SECRET: str = ""

    @property
    def email_configured(self) -> bool:
        return bool(self.RESEND_API_KEY) or bool(self.SMTP_HOST and self.SMTP_USER)

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

        return []

    @property
    def monnify_configured(self) -> bool:
        return bool(self.MONNIFY_API_KEY and self.MONNIFY_SECRET_KEY and self.MONNIFY_CONTRACT_CODE)

settings = Settings()
