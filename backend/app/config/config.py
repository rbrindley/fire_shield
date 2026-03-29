"""Application configuration using Pydantic Settings."""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_name: str = "Fire Shield"
    app_env: Literal["development", "production"] = "development"
    debug: bool = False
    secret_key: str = "change-me-in-production"

    # Database
    database_url: str = "data/app.db"

    # Admin
    admin_token: str = "change-me-admin-token"

    # Claude API
    anthropic_api_key: str | None = None
    claude_model: str = "claude-sonnet-4-6"

    # Embeddings
    embedding_model: str = "BAAI/bge-large-en-v1.5"
    embedding_device: Literal["auto", "cuda", "cpu"] = "auto"
    embedding_batch_size: int = 32
    vram_threshold_mb: int = 1500

    # Reranker
    reranker_model: str = "BAAI/bge-reranker-large"
    reranker_top_n: int = 12
    reranker_device: str = "cpu"

    # Qdrant
    qdrant_host: str = "localhost"
    qdrant_port: int = 6333
    qdrant_collection: str = "fire_shield_chunks"

    # Retrieval
    fts_top_k: int = 30
    vector_top_k: int = 30
    faithfulness_threshold: float = 0.45

    # Geocoding
    nominatim_user_agent: str = "fire-shield-app"

    # NWS (National Weather Service)
    nws_user_agent: str = "fire-shield contact@example.com"

    # LWF Plant API
    lwf_api_base: str = "https://lwf-api.vercel.app/api/v2"

    # CORS - frontend origin
    cors_origins: list[str] = ["http://localhost:3100"]

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"

    @property
    def claude_enabled(self) -> bool:
        return self.anthropic_api_key is not None and len(self.anthropic_api_key) > 0


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
