"""Jurisdiction and property profile API routes."""

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config.database import get_db
from app.jurisdiction.resolver import resolve_address, resolve_from_coords

router = APIRouter()


class AddressRequest(BaseModel):
    address: str
    session_id: str | None = None
    lat: float | None = None
    lng: float | None = None


class PropertyUpdateRequest(BaseModel):
    roof_type: str | None = None
    siding_type: str | None = None
    structure_type: str | None = None
    has_deck: bool | None = None
    deck_material: str | None = None
    deck_enclosed: bool | None = None
    has_attached_fence: bool | None = None
    fence_material: str | None = None
    slope_category: str | None = None
    environment: str | None = None
    outbuildings: str | None = None  # JSON string
    year_built: str | None = None
    owner_goals: str | None = None


@router.post("/resolve")
async def resolve_jurisdiction(req: AddressRequest) -> dict[str, Any]:
    """Geocode an address and resolve its jurisdiction."""
    if req.lat is not None and req.lng is not None:
        resolved = await resolve_from_coords(req.lat, req.lng, req.address)
    else:
        resolved = await resolve_address(req.address)

    # Persist property profile
    profile_id = str(uuid.uuid4())
    session_id = req.session_id or str(uuid.uuid4())

    async with get_db() as db:
        await db.execute(
            """INSERT INTO property_profiles
               (id, address, lat, lng, jurisdiction_code, session_id)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                profile_id,
                req.address,
                resolved.get("lat"),
                resolved.get("lng"),
                resolved.get("jurisdiction_code"),
                session_id,
            ),
        )
        await db.commit()

    return {
        **resolved,
        "property_profile_id": profile_id,
        "session_id": session_id,
    }


@router.patch("/profile/{profile_id}")
async def update_profile(profile_id: str, req: PropertyUpdateRequest) -> dict[str, Any]:
    """Update property profile details (roof type, siding, etc.)."""
    bool_fields = {"has_deck", "has_attached_fence", "deck_enclosed"}
    updates: list[str] = []
    params: list[Any] = []

    for field, value in req.model_dump(exclude_none=True).items():
        updates.append(f"{field} = ?")
        params.append(int(value) if field in bool_fields else value)

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    params.append(profile_id)
    async with get_db() as db:
        await db.execute(
            f"UPDATE property_profiles SET {', '.join(updates)} WHERE id = ?",
            params,
        )
        await db.commit()
        cursor = await db.execute(
            "SELECT * FROM property_profiles WHERE id = ?", (profile_id,)
        )
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Profile not found")
        return dict(row)


@router.get("/profile/{profile_id}")
async def get_profile(profile_id: str) -> dict[str, Any]:
    """Retrieve a property profile by ID."""
    async with get_db() as db:
        cursor = await db.execute(
            "SELECT * FROM property_profiles WHERE id = ?", (profile_id,)
        )
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Profile not found")
        return dict(row)


@router.get("/jurisdictions")
async def list_jurisdictions() -> list[dict[str, Any]]:
    """List all jurisdictions (used for admin dropdowns)."""
    async with get_db() as db:
        cursor = await db.execute(
            "SELECT code, display_name, parent_code, jurisdiction_chain FROM jurisdictions ORDER BY code"
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
