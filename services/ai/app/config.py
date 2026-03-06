from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"
    port: int = 8001

    internal_token: str = "change-me-internal-secret"

    # AI backend: "gemini_api" (free, default) or "vertex_ai" (MedGemma, production)
    gemini_backend: str = "gemini_api"
    gemini_api_key: str = ""   # from aistudio.google.com — free, no credit card

    # Only needed when gemini_backend=vertex_ai
    google_cloud_project_id: str = ""
    google_application_credentials: str = ""
    gcp_region: str = "asia-south1"
    vertex_ai_location: str = "us-central1"
    medgemma_4b_endpoint: str = "medgemma-4b-it"
    medgemma_27b_endpoint: str = "medgemma-27b-it"

    cxr_model_endpoint: str = ""

    ddi_db_url: str = ""
    ddi_api_key: str = ""

    ai_rate_limit_per_minute: int = 60

    sentry_dsn: str = ""


settings = Settings()
