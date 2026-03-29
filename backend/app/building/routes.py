"""Building footprint API routes."""

from typing import Any

from fastapi import APIRouter, Query

from app.building.service import find_building_footprint

router = APIRouter()


@router.get("/footprint")
async def get_building_footprint(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
) -> dict[str, Any]:
    """Return the nearest building footprint polygon as GeoJSON."""
    # Rough Oregon bounding box check
    if not (41.9 <= lat <= 46.3 and -124.7 <= lng <= -116.4):
        return {"footprint": None, "source": None, "reason": "outside_oregon"}

    result = await find_building_footprint(lat, lng)

    if result:
        return {
            "footprint": result["geojson"],
            "source": result["source"],
            "distance_m": round(result["distance_m"], 1),
        }

    return {"footprint": None, "source": None, "reason": "no_building_found"}
