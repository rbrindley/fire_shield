"""Audit routes for log export."""

import json
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
import csv
import io

from app.models.audit import AuditLogEntry, AuditExportRequest, PHIOverrideEntry
from app.auth.dependencies import require_admin
from app.config.database import get_db

router = APIRouter()


@router.get("/logs")
async def get_audit_logs(
    start_date: str | None = None,
    end_date: str | None = None,
    event_type: str | None = None,
    user_id: int | None = None,
    limit: int = 100,
    offset: int = 0,
    current_user: dict = Depends(require_admin),
) -> list[AuditLogEntry]:
    """Get audit logs with optional filters."""
    async with get_db() as db:
        query = """
            SELECT al.*, u.username
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE 1=1
        """
        params = []

        if start_date:
            query += " AND al.timestamp >= ?"
            params.append(start_date)

        if end_date:
            query += " AND al.timestamp <= ?"
            params.append(end_date)

        if event_type:
            query += " AND al.event_type = ?"
            params.append(event_type)

        if user_id:
            query += " AND al.user_id = ?"
            params.append(user_id)

        query += " ORDER BY al.timestamp DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        cursor = await db.execute(query, params)
        rows = await cursor.fetchall()

        return [
            AuditLogEntry(
                id=row["id"],
                timestamp=row["timestamp"],
                user_id=row["user_id"],
                username=row["username"],
                event_type=row["event_type"],
                event_data=json.loads(row["event_data"]) if row["event_data"] else None,
                ip_address=row["ip_address"],
            )
            for row in rows
        ]


@router.get("/export")
async def export_audit_logs(
    start_date: str | None = None,
    end_date: str | None = None,
    current_user: dict = Depends(require_admin),
):
    """Export audit logs as CSV."""
    async with get_db() as db:
        query = """
            SELECT al.*, u.username
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE 1=1
        """
        params = []

        if start_date:
            query += " AND al.timestamp >= ?"
            params.append(start_date)

        if end_date:
            query += " AND al.timestamp <= ?"
            params.append(end_date)

        query += " ORDER BY al.timestamp DESC"

        cursor = await db.execute(query, params)
        rows = await cursor.fetchall()

    # Generate CSV
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "timestamp", "user_id", "username", "event_type", "event_data", "ip_address"])

    for row in rows:
        writer.writerow([
            row["id"],
            row["timestamp"],
            row["user_id"],
            row["username"],
            row["event_type"],
            row["event_data"],
            row["ip_address"],
        ])

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=audit_logs.csv"},
    )


@router.get("/phi-overrides")
async def get_phi_overrides(
    current_user: dict = Depends(require_admin),
) -> list[PHIOverrideEntry]:
    """Get PHI override events."""
    async with get_db() as db:
        cursor = await db.execute(
            """
            SELECT poe.*, u.username
            FROM phi_override_events poe
            JOIN users u ON poe.user_id = u.id
            ORDER BY poe.timestamp DESC
            """
        )
        rows = await cursor.fetchall()

        return [
            PHIOverrideEntry(
                id=row["id"],
                timestamp=row["timestamp"],
                user_id=row["user_id"],
                username=row["username"],
                user_explanation=row["user_explanation"],
                admin_acknowledged=bool(row["admin_acknowledged"]),
                admin_acknowledged_at=row["admin_acknowledged_at"],
            )
            for row in rows
        ]


@router.post("/phi-overrides/{override_id}/acknowledge")
async def acknowledge_phi_override(
    override_id: int,
    current_user: dict = Depends(require_admin),
):
    """Acknowledge a PHI override event."""
    from datetime import datetime

    async with get_db() as db:
        await db.execute(
            """
            UPDATE phi_override_events
            SET admin_acknowledged = 1, admin_acknowledged_at = ?
            WHERE id = ?
            """,
            (datetime.utcnow().isoformat(), override_id),
        )
        await db.commit()

    return {"message": "Override acknowledged"}
