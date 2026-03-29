"""Zone action API routes."""

from typing import Any

from fastapi import APIRouter, Query

from app.zone.engine import get_zone_actions, get_top_actions

router = APIRouter()


@router.get("/")
async def zone_actions(
    jurisdiction: str | None = Query(None),
    season: str | None = Query(None),
) -> dict[str, Any]:
    """Get all 17 HIZ zone actions organized by layer with seasonal weighting."""
    return await get_zone_actions(jurisdiction_code=jurisdiction, season=season)


@router.get("/top")
async def top_actions(
    n: int = Query(3, ge=1, le=10),
    jurisdiction: str | None = Query(None),
) -> list[dict[str, Any]]:
    """Get top N actions by effective priority (used in property overview)."""
    return await get_top_actions(n=n)
