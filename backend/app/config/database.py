"""Database connection and initialization."""

import aiosqlite
from contextlib import asynccontextmanager
from pathlib import Path
import re
import sqlite3

from app.config import get_settings

settings = get_settings()

# Database path (plain file path, not SQLAlchemy URL)
DB_PATH = Path(settings.database_url)


@asynccontextmanager
async def get_db():
    """Get a database connection as an async context manager.
    
    Usage:
        async with get_db() as db:
            await db.execute(...)
    """
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA foreign_keys = ON")
    await db.execute("PRAGMA journal_mode = WAL")
    try:
        yield db
    finally:
        await db.close()


async def init_db() -> None:
    """Initialize the database and apply migrations."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    migrations_dir = Path(__file__).parent.parent / "migrations"
    if not migrations_dir.exists():
        return

    migration_files = sorted(
        [p for p in migrations_dir.glob("*.sql") if p.is_file()],
        key=lambda p: p.name,
    )

    db = await aiosqlite.connect(DB_PATH)
    try:
        # Track applied migrations to make startup idempotent.
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT UNIQUE NOT NULL,
                applied_at TEXT DEFAULT (datetime('now'))
            )
            """
        )
        await db.commit()

        cursor = await db.execute("SELECT filename FROM schema_migrations")
        rows = await cursor.fetchall()
        applied = {row[0] for row in rows}

        async def _column_exists(table: str, column: str) -> bool:
            cur = await db.execute(f"PRAGMA table_info({table})")
            cols = [r[1] for r in await cur.fetchall()]
            return column in cols

        async def _apply_migration_best_effort(sql_text: str) -> None:
            # Split on semicolons. This is safe for our ALTER/CREATE INDEX style
            # migrations, but is not safe for trigger bodies; only use as a fallback.
            for raw in sql_text.split(";"):
                stmt = raw.strip()
                if not stmt:
                    continue
                if stmt.startswith("--"):
                    continue

                m = re.match(
                    r"^ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+(\w+)\b",
                    stmt,
                    flags=re.IGNORECASE,
                )
                if m:
                    table, column = m.group(1), m.group(2)
                    if await _column_exists(table, column):
                        continue

                try:
                    await db.execute(stmt)
                except sqlite3.OperationalError as e:
                    msg = str(e).lower()
                    if "duplicate column name" in msg:
                        continue
                    raise

        for path in migration_files:
            if path.name in applied:
                continue

            sql = path.read_text(encoding="utf-8")
            try:
                try:
                    await db.executescript(sql)
                except sqlite3.OperationalError as e:
                    # If schema_migrations didn't exist previously, it's possible for
                    # columns to already be present while the migration isn't tracked.
                    # Apply a best-effort statement-by-statement run that skips already-
                    # present columns.
                    msg = str(e).lower()
                    if "duplicate column name" in msg and "create trigger" not in sql.lower():
                        await _apply_migration_best_effort(sql)
                    else:
                        raise
                await db.execute(
                    "INSERT INTO schema_migrations(filename) VALUES (?)", (path.name,)
                )
                await db.commit()
            except Exception:
                await db.rollback()
                raise
    finally:
        await db.close()


async def close_db(db: aiosqlite.Connection) -> None:
    """Close a database connection."""
    await db.close()
