"""
Aegis Application Settings.

Loads configuration from environment variables and .env file.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    # ── Application ─────────────────────────────────────
    PROJECT_NAME: str = "Aegis"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "change-me-in-production"

    # ── Database ────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://aegis:aegis@postgres:5432/aegis"

    # ── Qdrant ──────────────────────────────────────────
    QDRANT_URL: str = "http://qdrant:6333"

    # ── LLM / RAG ──────────────────────────────────────
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "gpt-4"


@lru_cache()
def get_settings() -> Settings:
    """Return cached application settings singleton."""
    return Settings()
