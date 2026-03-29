"""Pydantic models for audit operations."""

from pydantic import BaseModel


class AuditLogEntry(BaseModel):
    """Audit log entry."""

    id: int
    timestamp: str
    user_id: int | None
    username: str | None
    event_type: str
    event_data: dict | None
    ip_address: str | None


class AuditExportRequest(BaseModel):
    """Audit export request."""

    start_date: str | None = None
    end_date: str | None = None
    event_types: list[str] | None = None
    user_id: int | None = None


class PHIOverrideEntry(BaseModel):
    """PHI override event entry."""

    id: int
    timestamp: str
    user_id: int
    username: str
    user_explanation: str
    admin_acknowledged: bool
    admin_acknowledged_at: str | None
