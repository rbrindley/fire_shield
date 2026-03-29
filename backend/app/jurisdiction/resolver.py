"""Jurisdiction resolution: address → geocode → city/county → jurisdiction code."""

import json
import logging
from typing import Any

import httpx

from app.config import get_settings
from app.config.database import get_db

logger = logging.getLogger(__name__)
settings = get_settings()

# Map from Nominatim city/town names to jurisdiction codes
CITY_TO_JURISDICTION: dict[str, str] = {
    "ashland": "ashland",
    "jacksonville": "jacksonville",
    "medford": "medford",
    "talent": "talent",
    "phoenix": "phoenix",
    "central point": "central_point",
    "eagle point": "eagle_point",
    "grants pass": "grants_pass",
    "cave junction": "josephine_county",
    "gold hill": "jackson_county",
    "rogue river": "jackson_county",
    "shady cove": "jackson_county",
    "white city": "jackson_county",
    "applegate": "jackson_county",  # rural — use county
}

COUNTY_TO_JURISDICTION: dict[str, str] = {
    "jackson county": "jackson_county",
    "josephine county": "josephine_county",
}


async def geocode_address(address: str) -> dict[str, Any] | None:
    """Geocode an address using Nominatim and return structured result."""
    params = {
        "q": address,
        "format": "json",
        "addressdetails": 1,
        "limit": 1,
        "countrycodes": "us",
        "bounded": 0,
    }
    headers = {"User-Agent": settings.nominatim_user_agent}

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params=params,
                headers=headers,
            )
            resp.raise_for_status()
            results = resp.json()
            if not results:
                return None
            return results[0]
        except Exception as exc:
            logger.warning(f"Geocoding failed for '{address}': {exc}")
            return None


def _extract_jurisdiction_from_nominatim(result: dict) -> str:
    """Extract jurisdiction code from a Nominatim address result."""
    addr = result.get("address", {})

    # Try city/town/village in order
    city_raw = (
        addr.get("city")
        or addr.get("town")
        or addr.get("village")
        or addr.get("municipality")
        or ""
    ).lower().strip()

    if city_raw in CITY_TO_JURISDICTION:
        return CITY_TO_JURISDICTION[city_raw]

    # Partial match (e.g., "City of Medford" → "medford")
    for key, code in CITY_TO_JURISDICTION.items():
        if key in city_raw:
            return code

    # Fall back to county
    county_raw = addr.get("county", "").lower().strip()
    for key, code in COUNTY_TO_JURISDICTION.items():
        if key in county_raw:
            return code

    # State fallback
    state = addr.get("state", "").lower()
    if "oregon" in state:
        return "oregon_state"

    return "universal"


async def get_jurisdiction_chain(jurisdiction_code: str) -> list[str]:
    """Return the precomputed jurisdiction chain for filtering."""
    async with get_db() as db:
        cursor = await db.execute(
            "SELECT jurisdiction_chain FROM jurisdictions WHERE code = ?",
            (jurisdiction_code,),
        )
        row = await cursor.fetchone()
        if row:
            return json.loads(row["jurisdiction_chain"])
    # Fallback: construct minimal chain
    return [jurisdiction_code, "oregon_state", "federal", "universal"]


async def reverse_geocode(lat: float, lng: float) -> dict[str, Any] | None:
    """Reverse geocode a lat/lng using Nominatim."""
    params = {
        "lat": lat,
        "lon": lng,
        "format": "json",
        "addressdetails": 1,
    }
    headers = {"User-Agent": settings.nominatim_user_agent}

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(
                "https://nominatim.openstreetmap.org/reverse",
                params=params,
                headers=headers,
            )
            resp.raise_for_status()
            result = resp.json()
            if "error" in result:
                return None
            return result
        except Exception as exc:
            logger.warning(f"Reverse geocoding failed for ({lat}, {lng}): {exc}")
            return None


async def resolve_from_coords(lat: float, lng: float, address: str = "") -> dict[str, Any]:
    """Resolve jurisdiction from explicit lat/lng coordinates."""
    result = await reverse_geocode(lat, lng)

    if not result:
        jurisdiction_code = "jackson_county"
        jurisdiction_chain = await get_jurisdiction_chain(jurisdiction_code)
        return {
            "lat": lat,
            "lng": lng,
            "display_address": address or f"{lat}, {lng}",
            "jurisdiction_code": jurisdiction_code,
            "jurisdiction_display": "Jackson County, Oregon",
            "jurisdiction_chain": jurisdiction_chain,
            "city": None,
            "county": "Jackson County",
            "geocode_failed": False,
        }

    display = result.get("display_name", address or f"{lat}, {lng}")
    addr = result.get("address", {})
    city = addr.get("city") or addr.get("town") or addr.get("village")
    county = addr.get("county")

    jurisdiction_code = _extract_jurisdiction_from_nominatim(result)
    jurisdiction_chain = await get_jurisdiction_chain(jurisdiction_code)

    async with get_db() as db:
        cursor = await db.execute(
            "SELECT display_name FROM jurisdictions WHERE code = ?",
            (jurisdiction_code,),
        )
        row = await cursor.fetchone()
        jurisdiction_display = row["display_name"] if row else jurisdiction_code

    return {
        "lat": lat,
        "lng": lng,
        "display_address": display,
        "jurisdiction_code": jurisdiction_code,
        "jurisdiction_display": jurisdiction_display,
        "jurisdiction_chain": jurisdiction_chain,
        "city": city,
        "county": county,
        "geocode_failed": False,
    }


async def resolve_address(address: str) -> dict[str, Any]:
    """
    Full resolution: address → geocoded point → jurisdiction.

    Returns:
        {
          lat, lng, display_address,
          jurisdiction_code, jurisdiction_display,
          jurisdiction_chain,
          county, city
        }
    """
    result = await geocode_address(address)
    if not result:
        return {
            "lat": None,
            "lng": None,
            "display_address": address,
            "jurisdiction_code": "jackson_county",
            "jurisdiction_display": "Jackson County, Oregon",
            "jurisdiction_chain": ["jackson_county", "oregon_state", "federal", "universal"],
            "city": None,
            "county": "Jackson County",
            "geocode_failed": True,
        }

    lat = float(result.get("lat", 0))
    lng = float(result.get("lon", 0))
    display = result.get("display_name", address)
    addr = result.get("address", {})
    city = addr.get("city") or addr.get("town") or addr.get("village")
    county = addr.get("county")

    jurisdiction_code = _extract_jurisdiction_from_nominatim(result)
    jurisdiction_chain = await get_jurisdiction_chain(jurisdiction_code)

    # Human-readable display
    async with get_db() as db:
        cursor = await db.execute(
            "SELECT display_name FROM jurisdictions WHERE code = ?",
            (jurisdiction_code,),
        )
        row = await cursor.fetchone()
        jurisdiction_display = row["display_name"] if row else jurisdiction_code

    return {
        "lat": lat,
        "lng": lng,
        "display_address": display,
        "jurisdiction_code": jurisdiction_code,
        "jurisdiction_display": jurisdiction_display,
        "jurisdiction_chain": jurisdiction_chain,
        "city": city,
        "county": county,
        "geocode_failed": False,
    }
