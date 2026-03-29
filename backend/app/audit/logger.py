"""Audit event logging."""

import json
from datetime import datetime
from typing import Literal

from app.database import get_db


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


# =============================================================================
# CLOUD EXTRACTION AUDIT
# =============================================================================

CloudExtractionStatus = Literal["started", "success", "failed", "cancelled", "timeout"]


async def log_cloud_extraction_start(
    doc_version_id: int,
    provider: str,
    user_id: int | None = None,
    instance_count: int = 1,
    gpu_type: str | None = None,
    instance_id: str | None = None,
    region: str | None = None,
    metadata: dict | None = None,
) -> int:
    """Log the start of a cloud extraction. Returns audit record ID."""
    async with get_db() as db:
        cursor = await db.execute(
            """
            INSERT INTO cloud_extraction_audit 
            (doc_version_id, user_id, provider, instance_count, gpu_type, 
             instance_id, region, metadata, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'started')
            """,
            (
                doc_version_id,
                user_id,
                provider,
                instance_count,
                gpu_type,
                instance_id,
                region,
                json.dumps(metadata) if metadata else None,
            ),
        )
        audit_id = cursor.lastrowid
        await db.commit()

    # Also log to general audit
    await log_event(
        event_type=EventTypes.CLOUD_EXTRACTION_STARTED,
        user_id=user_id,
        event_data={
            "doc_version_id": doc_version_id,
            "provider": provider,
            "instance_count": instance_count,
        },
    )

    return audit_id


async def log_cloud_extraction_complete(
    audit_id: int,
    status: CloudExtractionStatus,
    pages_processed: int | None = None,
    duration_seconds: float | None = None,
    cost_usd: float | None = None,
    error_message: str | None = None,
) -> None:
    """Log the completion of a cloud extraction."""
    async with get_db() as db:
        await db.execute(
            """
            UPDATE cloud_extraction_audit 
            SET completed_at = ?,
                status = ?,
                pages_processed = ?,
                duration_seconds = ?,
                cost_usd = ?,
                error_message = ?
            WHERE id = ?
            """,
            (
                datetime.utcnow().isoformat(),
                status,
                pages_processed,
                duration_seconds,
                cost_usd,
                error_message,
                audit_id,
            ),
        )
        await db.commit()

    # Also log to general audit
    event_type = (
        EventTypes.CLOUD_EXTRACTION_COMPLETED
        if status == "success"
        else EventTypes.CLOUD_EXTRACTION_FAILED
    )
    await log_event(
        event_type=event_type,
        event_data={
            "audit_id": audit_id,
            "status": status,
            "pages_processed": pages_processed,
            "cost_usd": cost_usd,
            "error": error_message,
        },
    )


async def get_current_month_spend() -> tuple[float, int]:
    """Get current month's cloud spend and extraction count."""
    async with get_db() as db:
        cursor = await db.execute(
            "SELECT total_spend, extraction_count FROM v_current_month_spend"
        )
        row = await cursor.fetchone()
        if row:
            return (row["total_spend"] or 0.0, row["extraction_count"] or 0)
        return (0.0, 0)


async def get_cloud_usage_stats(days: int = 30) -> dict:
    """Get cloud usage statistics for the last N days."""
    async with get_db() as db:
        cursor = await db.execute(
            """
            SELECT 
                provider,
                COUNT(*) as extraction_count,
                SUM(pages_processed) as total_pages,
                SUM(cost_usd) as total_cost,
                AVG(duration_seconds) as avg_duration,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count
            FROM cloud_extraction_audit
            WHERE started_at >= datetime('now', ?)
            GROUP BY provider
            """,
            (f"-{days} days",),
        )
        rows = await cursor.fetchall()

        stats = {
            "period_days": days,
            "providers": {},
            "totals": {
                "extraction_count": 0,
                "total_pages": 0,
                "total_cost": 0.0,
                "success_count": 0,
                "failed_count": 0,
            },
        }

        for row in rows:
            provider = row["provider"]
            stats["providers"][provider] = {
                "extraction_count": row["extraction_count"],
                "total_pages": row["total_pages"] or 0,
                "total_cost": row["total_cost"] or 0.0,
                "avg_duration": row["avg_duration"] or 0.0,
                "success_count": row["success_count"],
                "failed_count": row["failed_count"],
                "success_rate": (
                    row["success_count"] / row["extraction_count"] * 100
                    if row["extraction_count"] > 0
                    else 0
                ),
            }
            stats["totals"]["extraction_count"] += row["extraction_count"]
            stats["totals"]["total_pages"] += row["total_pages"] or 0
            stats["totals"]["total_cost"] += row["total_cost"] or 0.0
            stats["totals"]["success_count"] += row["success_count"]
            stats["totals"]["failed_count"] += row["failed_count"]

        return stats


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
    # Cloud extraction events
    CLOUD_EXTRACTION_STARTED = "cloud_extraction_started"
    CLOUD_EXTRACTION_COMPLETED = "cloud_extraction_completed"
    CLOUD_EXTRACTION_FAILED = "cloud_extraction_failed"
