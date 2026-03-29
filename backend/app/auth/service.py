"""Authentication service."""

import secrets
from datetime import datetime, timedelta

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.config import get_settings
from app.config.database import get_db

settings = get_settings()
ph = PasswordHasher()


class AuthService:
    """Authentication service for user management and sessions."""

    async def authenticate(
        self,
        username: str,
        password: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> tuple[str, dict] | None:
        """Authenticate user and create session."""
        async with get_db() as db:
            # Get user
            cursor = await db.execute(
                "SELECT * FROM users WHERE username = ? AND is_active = 1",
                (username,),
            )
            user = await cursor.fetchone()

            if not user:
                return None

            user_dict = dict(user)

            # Check if locked
            if user_dict.get("locked_until"):
                locked_until = datetime.fromisoformat(user_dict["locked_until"])
                if locked_until > datetime.utcnow():
                    return None
                # Lock expired, reset
                await db.execute(
                    "UPDATE users SET locked_until = NULL, failed_login_attempts = 0 WHERE id = ?",
                    (user_dict["id"],),
                )

            # Verify password
            try:
                ph.verify(user_dict["password_hash"], password)
            except VerifyMismatchError:
                # Increment failed attempts
                failed_attempts = user_dict.get("failed_login_attempts", 0) + 1
                if failed_attempts >= settings.login_rate_limit_attempts:
                    locked_until = datetime.utcnow() + timedelta(
                        minutes=settings.lockout_duration_minutes
                    )
                    await db.execute(
                        "UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?",
                        (failed_attempts, locked_until.isoformat(), user_dict["id"]),
                    )
                else:
                    await db.execute(
                        "UPDATE users SET failed_login_attempts = ? WHERE id = ?",
                        (failed_attempts, user_dict["id"]),
                    )
                await db.commit()
                return None

            # Reset failed attempts on successful login
            await db.execute(
                "UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = ? WHERE id = ?",
                (datetime.utcnow().isoformat(), user_dict["id"]),
            )

            # Create session
            session_id = secrets.token_urlsafe(32)
            expires_at = datetime.utcnow() + timedelta(minutes=settings.session_expire_minutes)

            await db.execute(
                """
                INSERT INTO sessions (id, user_id, expires_at, ip_address, user_agent)
                VALUES (?, ?, ?, ?, ?)
                """,
                (session_id, user_dict["id"], expires_at.isoformat(), ip_address, user_agent),
            )
            await db.commit()

            return session_id, user_dict

    async def validate_session(self, session_id: str) -> dict | None:
        """Validate session and return user if valid."""
        async with get_db() as db:
            cursor = await db.execute(
                """
                SELECT u.*, s.expires_at
                FROM sessions s
                JOIN users u ON s.user_id = u.id
                WHERE s.id = ? AND u.is_active = 1
                """,
                (session_id,),
            )
            row = await cursor.fetchone()

            if not row:
                return None

            user_dict = dict(row)
            expires_at = datetime.fromisoformat(user_dict.pop("expires_at"))

            if expires_at < datetime.utcnow():
                await db.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
                await db.commit()
                return None

            return user_dict

    async def logout(self, session_id: str) -> None:
        """Delete session."""
        async with get_db() as db:
            await db.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
            await db.commit()

    async def extend_session(self, session_id: str) -> datetime | None:
        """Extend session expiry time."""
        async with get_db() as db:
            # Calculate new expiry time
            new_expires = datetime.utcnow() + timedelta(minutes=settings.session_expire_minutes)

            cursor = await db.execute(
                """
                UPDATE sessions
                SET expires_at = ?
                WHERE id = ?
                RETURNING expires_at
                """,
                (new_expires.isoformat(), session_id),
            )

            row = await cursor.fetchone()
            await db.commit()

            if row:
                return new_expires
            return None

    async def create_user(
        self,
        username: str,
        email: str,
        password: str,
        is_admin: bool = False,
    ) -> dict:
        """Create a new user."""
        password_hash = ph.hash(password)

        async with get_db() as db:
            cursor = await db.execute(
                """
                INSERT INTO users (username, email, password_hash, is_admin)
                VALUES (?, ?, ?, ?)
                """,
                (username, email, password_hash, int(is_admin)),
            )
            user_id = cursor.lastrowid
            await db.commit()

            cursor = await db.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            user = await cursor.fetchone()
            return dict(user)
