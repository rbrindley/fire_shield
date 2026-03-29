"""Backwards-compatibility shim — re-exports from app.config.database."""

from app.config.database import get_db, init_db, close_db

__all__ = ["get_db", "init_db", "close_db"]
