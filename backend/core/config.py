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
    QDRANT_COLLECTION_NAME: str = "aegis_nist_docs"
    DOCS_SOURCE_DIR: str = "docs/nist"

    # ── LLM / RAG ──────────────────────────────────────
    EMBEDDING_PROVIDER_MODE: str = "local"
    LOCAL_EMBEDDING_MODEL: str = "deterministic-hash-v1"
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "openai/gpt-4o-mini"
    OPENROUTER_EMBEDDING_MODEL: str = "text-embedding-3-small"
    LLM_PROVIDER_MODE: str = "deterministic"
    RAG_TOP_K: int = 5
    LLM_TIMEOUT_SECONDS: float = 15.0
    EMBEDDING_TIMEOUT_SECONDS: float = 15.0

    # Certificate issuer
    CERT_ISSUER_COMMON_NAME: str = "Aegis Compliance CA"
    CERT_ISSUER_ORGANIZATION: str = "Aegis"
    CERT_ISSUER_ORG_UNIT: str = "Quantum Compliance"
    CERT_RUNTIME_DIR: str = ".aegis-runtime/certs"


@lru_cache()
def get_settings() -> Settings:
    """Return cached application settings singleton."""
    return Settings()
