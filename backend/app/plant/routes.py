"""Plant search routes."""

from fastapi import APIRouter, Query

from app.config.database import get_db

router = APIRouter()


@router.get("/search")
async def search_plants(
    query: str | None = Query(None, description="Natural language search query"),
    zone: str | None = Query(None, description="HIZ zone: zone_0_5ft, zone_5_30ft, zone_30_100ft, zone_100ft_plus"),
    native: bool = Query(False),
    deer_resistant: bool = Query(False),
    pollinator_support: bool = Query(False),
    sun: str | None = Query(None, description="full, partial, shade"),
    water_need: str | None = Query(None, description="low, medium, high"),
    exclude_restricted: bool = Query(False, description="Exclude Ashland-restricted plants"),
    exclude_noxious: bool = Query(True, description="Exclude noxious weeds"),
    limit: int = Query(20, le=100),
    offset: int = Query(0),
):
    """Search fire-resistant plants with optional filters."""
    async with get_db() as db:
        conditions = []
        params: list = []

        # Text search against common_name and scientific_name
        if query:
            # Simple LIKE search — FTS on plants not indexed, good enough for demo
            like_term = f"%{query}%"
            conditions.append(
                "(common_name LIKE ? OR scientific_name LIKE ? OR fire_behavior_notes LIKE ?)"
            )
            params.extend([like_term, like_term, like_term])

        # Zone filter
        valid_zones = {"zone_0_5ft", "zone_5_30ft", "zone_30_100ft", "zone_100ft_plus"}
        if zone and zone in valid_zones:
            conditions.append(f"{zone} = 1")

        if native:
            conditions.append("is_native = 1")
        if deer_resistant:
            conditions.append("deer_resistant = 1")
        if pollinator_support:
            conditions.append("pollinator_support = 1")
        if sun:
            conditions.append("sun = ?")
            params.append(sun)
        if water_need:
            conditions.append("water_need = ?")
            params.append(water_need)
        if exclude_restricted:
            conditions.append("ashland_restricted = 0")
        if exclude_noxious:
            conditions.append("is_noxious_weed = 0")

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        cursor = await db.execute(
            f"""
            SELECT id, common_name, scientific_name, plant_type,
                   zone_0_5ft, zone_5_30ft, zone_30_100ft, zone_100ft_plus,
                   water_need, is_native, deer_resistant, pollinator_support,
                   sun, mature_height_min_ft, mature_height_max_ft,
                   fire_behavior_notes, placement_notes,
                   ashland_restricted, ashland_restriction_type,
                   is_noxious_weed, primary_image_url, source_url
            FROM plants
            {where}
            ORDER BY
                -- Prioritize zone-eligible, native, low-water plants
                (zone_0_5ft + zone_5_30ft) DESC,
                is_native DESC,
                CASE water_need WHEN 'low' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END ASC,
                common_name ASC
            LIMIT ? OFFSET ?
            """,
            (*params, limit, offset),
        )
        rows = await cursor.fetchall()

        count_cursor = await db.execute(
            f"SELECT COUNT(*) FROM plants {where}",
            params,
        )
        total = (await count_cursor.fetchone())[0]

    plants = []
    for row in rows:
        p = dict(row)
        # Convert SQLite integers to booleans for JSON
        for bool_field in ("zone_0_5ft", "zone_5_30ft", "zone_30_100ft", "zone_100ft_plus",
                           "is_native", "deer_resistant", "pollinator_support",
                           "ashland_restricted", "is_noxious_weed"):
            p[bool_field] = bool(p[bool_field])
        plants.append(p)

    return {"plants": plants, "total": total, "limit": limit, "offset": offset}


@router.get("/{plant_id}")
async def get_plant(plant_id: str):
    """Get a single plant by ID."""
    async with get_db() as db:
        cursor = await db.execute(
            "SELECT * FROM plants WHERE id = ?",
            (plant_id,),
        )
        row = await cursor.fetchone()

    if not row:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Plant not found")

    p = dict(row)
    for bool_field in ("zone_0_5ft", "zone_5_30ft", "zone_30_100ft", "zone_100ft_plus",
                       "is_native", "deer_resistant", "pollinator_support",
                       "ashland_restricted", "is_noxious_weed"):
        p[bool_field] = bool(p[bool_field])
    return p
