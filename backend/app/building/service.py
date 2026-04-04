"""Building footprint lookup — Microsoft FlatGeobuf + Overpass API fallback."""

import logging
import os
from pathlib import Path

import httpx

logger = logging.getLogger(__name__)

DATA_DIR = os.environ.get("DATA_DIR", "data")

# Try both filenames — regional subset preferred
_FGB_CANDIDATES = [
    Path(DATA_DIR) / "rogue_valley_buildings.fgb",
    Path(DATA_DIR) / "oregon_buildings.fgb",
]

# Lazy-loaded flag
_geopandas_available: bool | None = None


def _get_fgb_path() -> Path | None:
    for p in _FGB_CANDIDATES:
        if p.exists():
            return p
    return None


def _check_geopandas() -> bool:
    global _geopandas_available
    if _geopandas_available is None:
        try:
            import geopandas  # noqa: F401
            _geopandas_available = True
        except ImportError:
            logger.info("geopandas not installed — FlatGeobuf queries disabled")
            _geopandas_available = False
    return _geopandas_available


def _query_fgb(lat: float, lng: float, radius_deg: float = 0.002) -> dict | None:
    """Query local FlatGeobuf file for nearest building to a point.

    radius_deg ~0.002 is roughly 200m at Oregon's latitude.
    """
    if not _check_geopandas():
        return None

    fgb_path = _get_fgb_path()
    if not fgb_path:
        logger.debug("No FlatGeobuf file found — skipping local query")
        return None

    import geopandas as gpd
    from shapely.geometry import Point

    bbox = (lng - radius_deg, lat - radius_deg, lng + radius_deg, lat + radius_deg)

    try:
        gdf = gpd.read_file(fgb_path, bbox=bbox, engine="pyogrio")
    except Exception as e:
        logger.warning(f"FlatGeobuf read error: {e}")
        return None

    if gdf.empty:
        return None

    point = Point(lng, lat)
    gdf["_dist"] = gdf.geometry.distance(point)
    nearest = gdf.loc[gdf["_dist"].idxmin()]

    geojson = nearest.geometry.__geo_interface__

    return {
        "geojson": geojson,
        "source": "microsoft",
        "distance_m": nearest["_dist"] * 111_320,  # rough deg-to-meters at ~42°N
    }


async def _query_overpass(lat: float, lng: float) -> dict | None:
    """Fallback: query OSM Overpass API for building polygon at lat/lng."""
    query = f"""
    [out:json][timeout:5];
    way["building"](around:100,{lat},{lng});
    out body; >; out skel qt;
    """

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(
                "https://overpass-api.de/api/interpreter",
                data={"data": query},
            )
            if resp.status_code != 200:
                logger.info(f"Overpass returned {resp.status_code}")
                return None

            data = resp.json()
            elements = data.get("elements", [])

            # Build node lookup
            nodes: dict[int, tuple[float, float]] = {}
            ways: list[dict] = []
            for el in elements:
                if el["type"] == "node":
                    nodes[el["id"]] = (el["lon"], el["lat"])
                elif el["type"] == "way" and "tags" in el:
                    ways.append(el)

            if not ways:
                return None

            # Pick the nearest building by centroid distance
            best_way = None
            best_dist = float("inf")
            for w in ways:
                w_coords = [nodes[nid] for nid in w.get("nodes", []) if nid in nodes]
                if len(w_coords) < 4:
                    continue
                cx = sum(c[0] for c in w_coords) / len(w_coords)
                cy = sum(c[1] for c in w_coords) / len(w_coords)
                d = (cx - lng) ** 2 + (cy - lat) ** 2
                if d < best_dist:
                    best_dist = d
                    best_way = w_coords

            if not best_way:
                return None

            coords = best_way
            # Ensure ring is closed
            if coords[0] != coords[-1]:
                coords.append(coords[0])

            dist_m = best_dist ** 0.5 * 111_320  # rough deg-to-meters

            geojson = {
                "type": "Polygon",
                "coordinates": [coords],
            }

            return {
                "geojson": geojson,
                "source": "openstreetmap",
                "distance_m": round(dist_m, 1),
            }

    except httpx.TimeoutException:
        logger.info("Overpass API timeout")
    except Exception as e:
        logger.info(f"Overpass query failed: {e}")

    return None


async def find_building_footprint(lat: float, lng: float) -> dict | None:
    """Find the nearest building polygon to a lat/lng point.

    Strategy:
    1. Query local FlatGeobuf (Microsoft buildings) — fast, ~200m radius
    2. If not found, try Overpass API (OSM) — slower, ~100m radius
    3. Return None if no building found anywhere
    """
    # Try local FlatGeobuf first
    result = _query_fgb(lat, lng)
    if result:
        return result

    # Try wider local search before hitting Overpass
    result = _query_fgb(lat, lng, radius_deg=0.005)
    if result:
        return result

    # Overpass fallback
    result = await _query_overpass(lat, lng)
    return result
