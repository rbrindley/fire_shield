"""
Top-level test fixtures shared across unit and integration tests.

Provides:
- test_db: isolated SQLite database with all migrations applied
- app_client: HTTPX AsyncClient wired to the FastAPI ASGI app

All async fixtures work under asyncio_mode = "auto" (set in pyproject.toml).
"""

import pytest
import pytest_asyncio
import app.config.database as db_module
from app.config.database import init_db


@pytest_asyncio.fixture
async def test_db(tmp_path, monkeypatch):
    """
    Isolated SQLite database for a single test.

    Patches the global DB_PATH so that both init_db() and every get_db()
    call in app code write to a temporary file rather than data/app.db.
    Runs all migrations so zone_actions and jurisdictions are seeded.

    Does NOT patch app settings — only the resolved DB_PATH path object.
    Does NOT provide plant records; use integration/conftest.py seeded_db for that.
    """
    db_file = tmp_path / "test.db"
    monkeypatch.setattr(db_module, "DB_PATH", db_file)
    await init_db()
    yield db_file


@pytest_asyncio.fixture
async def app_client(test_db):
    """
    HTTPX AsyncClient backed by the FastAPI ASGI app using the test database.

    The lifespan startup calls init_db(), which is idempotent when the DB
    already has a schema_migrations table. Subsequent calls skip applied
    migrations, so the test data seeded by test_db is preserved.

    Yields the client for the duration of the test, then shuts down lifespan.
    """
    from httpx import AsyncClient, ASGITransport
    from app.config.main import create_app

    application = create_app()
    async with AsyncClient(
        transport=ASGITransport(app=application),
        base_url="http://test",
    ) as client:
        yield client
