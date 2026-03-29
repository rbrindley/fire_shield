"""Admin routes for corpus management, plant sync, and zone action editing."""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, status
from pydantic import BaseModel

from app.config import get_settings
from app.config.database import get_db

router = APIRouter()
settings = get_settings()
logger = logging.getLogger(__name__)


def _check_admin(
    admin_token: str | None = Cookie(None),
    x_admin_token: str | None = Header(None),
):
    """Verify admin token from cookie or X-Admin-Token header."""
    token = admin_token or x_admin_token
    if not token or token != settings.admin_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing admin token",
        )


# ── Corpus Sources ──────────────────────────────────────────────────────────

@router.get("/corpus")
async def list_corpus_sources(_=Depends(_check_admin)):
    """List all corpus sources with status and metadata."""
    async with get_db() as db:
        cursor = await db.execute(
            """
            SELECT cs.id, cs.title, cs.source_url, cs.jurisdiction,
                   cs.trust_tier, cs.document_date, cs.ingestion_date, cs.status,
                   cs.document_id,
                   j.display_name as jurisdiction_display,
                   j.jurisdiction_chain
            FROM corpus_sources cs
            LEFT JOIN jurisdictions j ON cs.jurisdiction = j.code
            ORDER BY cs.trust_tier, cs.jurisdiction, cs.title
            """
        )
        rows = await cursor.fetchall()
    return [dict(row) for row in rows]


class CorpusSourceUpdate(BaseModel):
    jurisdiction: str | None = None
    trust_tier: int | None = None
    status: str | None = None
    source_url: str | None = None


@router.patch("/corpus/{source_id}")
async def update_corpus_source(
    source_id: int,
    update: CorpusSourceUpdate,
    _=Depends(_check_admin),
):
    """Update corpus source metadata (jurisdiction, trust tier, status)."""
    fields = []
    params = []
    if update.jurisdiction is not None:
        fields.append("jurisdiction = ?")
        params.append(update.jurisdiction)
    if update.trust_tier is not None:
        fields.append("trust_tier = ?")
        params.append(update.trust_tier)
    if update.status is not None:
        if update.status not in ("active", "stale", "pending", "error"):
            raise HTTPException(status_code=400, detail="Invalid status value")
        fields.append("status = ?")
        params.append(update.status)
    if update.source_url is not None:
        fields.append("source_url = ?")
        params.append(update.source_url)

    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    params.append(source_id)
    async with get_db() as db:
        await db.execute(
            f"UPDATE corpus_sources SET {', '.join(fields)} WHERE id = ?",
            params,
        )
        if update.jurisdiction or update.trust_tier or update.status:
            cursor = await db.execute(
                "SELECT document_id FROM corpus_sources WHERE id = ?", (source_id,)
            )
            row = await cursor.fetchone()
            if row and row[0]:
                doc_id = row[0]
                doc_fields = []
                doc_params = []
                if update.jurisdiction:
                    doc_fields.append("jurisdiction = ?")
                    doc_params.append(update.jurisdiction)
                if update.trust_tier:
                    doc_fields.append("trust_tier = ?")
                    doc_params.append(update.trust_tier)
                if update.status:
                    doc_fields.append("status = ?")
                    doc_params.append(update.status)
                if doc_fields:
                    doc_params.append(doc_id)
                    await db.execute(
                        f"UPDATE documents SET {', '.join(doc_fields)} WHERE id = ?",
                        doc_params,
                    )
        await db.commit()

    return {"status": "updated"}


@router.delete("/corpus/{source_id}")
async def deprecate_corpus_source(
    source_id: int,
    _=Depends(_check_admin),
):
    """Mark a corpus source as stale (soft-delete)."""
    async with get_db() as db:
        cursor = await db.execute(
            "SELECT document_id FROM corpus_sources WHERE id = ?", (source_id,)
        )
        row = await cursor.fetchone()
        if row and row[0]:
            await db.execute(
                "UPDATE documents SET status = 'stale' WHERE id = ?", (row[0],)
            )
        await db.execute(
            "UPDATE corpus_sources SET status = 'stale' WHERE id = ?", (source_id,)
        )
        await db.commit()

    return {"status": "deprecated"}


@router.get("/corpus/jurisdiction-preview/{jurisdiction_code}")
async def jurisdiction_chain_preview(
    jurisdiction_code: str,
    _=Depends(_check_admin),
):
    """Preview the jurisdiction chain for a given code."""
    from app.rag.smart_filter import build_jurisdiction_chain

    chain = build_jurisdiction_chain(jurisdiction_code)
    return {"jurisdiction_code": jurisdiction_code, "chain": chain}


# ── Plant Management ─────────────────────────────────────────────────────────

@router.post("/plants/sync")
async def sync_plants(_=Depends(_check_admin)):
    """Trigger LWF plant database sync."""
    from app.plant.adapter import sync_lwf_plants

    result = await sync_lwf_plants()
    return result


@router.get("/plants/sync-log")
async def plant_sync_log(_=Depends(_check_admin)):
    """Get the last 10 plant sync events."""
    async with get_db() as db:
        cursor = await db.execute(
            """
            SELECT synced_at, plants_upserted, plants_skipped, errors, status
            FROM plant_sync_log
            ORDER BY synced_at DESC
            LIMIT 10
            """
        )
        rows = await cursor.fetchall()
    return [dict(row) for row in rows]


class PlantOverride(BaseModel):
    ashland_restricted: bool | None = None
    placement_notes: str | None = None


@router.patch("/plants/{plant_id}/override")
async def override_plant(
    plant_id: str,
    override: PlantOverride,
    _=Depends(_check_admin),
):
    """Manually override plant attributes (e.g. ashland_restricted)."""
    fields = []
    params = []
    if override.ashland_restricted is not None:
        fields.append("ashland_restricted = ?")
        params.append(int(override.ashland_restricted))
    if override.placement_notes is not None:
        fields.append("placement_notes = ?")
        params.append(override.placement_notes)

    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    params.append(plant_id)
    async with get_db() as db:
        result = await db.execute(
            f"UPDATE plants SET {', '.join(fields)} WHERE id = ?",
            params,
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Plant not found")
        await db.commit()

    return {"status": "updated"}


# ── Zone Actions ─────────────────────────────────────────────────────────────

@router.get("/zones")
async def list_zone_actions(_=Depends(_check_admin)):
    """List all zone actions grouped by layer."""
    async with get_db() as db:
        cursor = await db.execute(
            """
            SELECT id, layer, layer_name, rank_in_layer,
                   action_title, action_detail, why_it_matters, evidence_citation,
                   effort_level, cost_estimate, time_estimate,
                   seasonal_peak, priority_score, neighbor_effect
            FROM zone_actions
            ORDER BY layer, rank_in_layer
            """
        )
        rows = await cursor.fetchall()
    return [dict(row) for row in rows]


class ZoneActionUpdate(BaseModel):
    action_title: str | None = None
    action_detail: str | None = None
    why_it_matters: str | None = None
    evidence_citation: str | None = None
    priority_score: float | None = None
    seasonal_peak: str | None = None  # JSON array string
    rank_in_layer: int | None = None


@router.patch("/zones/{action_id}")
async def update_zone_action(
    action_id: str,
    update: ZoneActionUpdate,
    _=Depends(_check_admin),
):
    """Update a zone action's content or priority."""
    fields = []
    params = []
    for field, value in update.model_dump(exclude_none=True).items():
        fields.append(f"{field} = ?")
        params.append(value)

    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    params.append(action_id)
    async with get_db() as db:
        result = await db.execute(
            f"UPDATE zone_actions SET {', '.join(fields)} WHERE id = ?",
            params,
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Zone action not found")
        await db.commit()

    return {"status": "updated"}
