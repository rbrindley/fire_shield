"""Audit event logging."""

import json
from datetime import datetime

from app.config.database import get_db


async def log_event(
    event_type: str,
    user_id: int | None = None,
    event_data: dict | None = None,
    ip_address: str | None = None,
) -> None:
    """Log an audit event."""
    async with get_db() as db:
        await db.execute(
            """
            INSERT INTO audit_logs (timestamp, user_id, event_type, event_data, ip_address)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                datetime.utcnow().isoformat(),
                user_id,
                event_type,
                json.dumps(event_data) if event_data else None,
                ip_address,
            ),
        )
        await db.commit()


async def log_phi_override(
    user_id: int,
    explanation: str,
) -> None:
    """Log a PHI override event."""
    async with get_db() as db:
        await db.execute(
            """
            INSERT INTO phi_override_events (timestamp, user_id, user_explanation)
            VALUES (?, ?, ?)
            """,
            (datetime.utcnow().isoformat(), user_id, explanation),
        )
        await db.commit()

    # Also log to general audit
    await log_event(
        event_type="phi_override",
        user_id=user_id,
        event_data={"explanation_provided": True},
    )



# Event type constants
class EventTypes:
    LOGIN_SUCCESS = "login_success"
    LOGIN_FAILED = "login_failed"
    LOGOUT = "logout"
    QUERY_SUBMITTED = "query_submitted"
    DOCUMENT_UPLOADED = "document_uploaded"
    DOCUMENT_DELETED = "document_deleted"
    USER_CREATED = "user_created"
    USER_UPDATED = "user_updated"
    PHI_OVERRIDE = "phi_override"
    ADMIN_ACTION = "admin_action"
