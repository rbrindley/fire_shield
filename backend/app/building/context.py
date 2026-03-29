"""Property context enrichment: urban/rural classification + neighbor distance."""

import logging

from app.building.service import _check_geopandas, _get_fgb_path
from app.jurisdiction.resolver import (
    CITY_TO_JURISDICTION,
    COUNTY_TO_JURISDICTION,
)

logger = logging.getLogger(__name__)

# Jurisdictions that map directly to a city are "urban"
_URBAN_JURISDICTIONS = {
    code
    for code in CITY_TO_JURISDICTION.values()
    if code not in COUNTY_TO_JURISDICTION.values()
}


def classify_area_type(jurisdiction_code: str) -> str:
    """Classify a jurisdiction as urban or rural."""
    if jurisdiction_code in _URBAN_JURISDICTIONS:
        return "urban"
    return "rural"


def find_nearest_neighbor_distance(lat: float, lng: float) -> float | None:
    """Find the distance in meters to the nearest neighboring building.

    Queries all buildings within ~500m, identifies the closest one (likely the
    user's own home), then returns the distance to the second-closest building.
    If only one building is found, returns None (no neighbor detected).
    """
    if not _check_geopandas():
        return None

    fgb_path = _get_fgb_path()
    if not fgb_path:
        return None

    import geopandas as gpd
    from shapely.geometry import Point

    point = Point(lng, lat)

    # Search in a ~500m radius (0.005 degrees at ~42°N)
    radius_deg = 0.005
    bbox = (lng - radius_deg, lat - radius_deg, lng + radius_deg, lat + radius_deg)

    try:
        gdf = gpd.read_file(fgb_path, bbox=bbox, engine="pyogrio")
    except Exception as e:
        logger.warning(f"FlatGeobuf read error for neighbor search: {e}")
        return None

    if len(gdf) < 2:
        # 0 or 1 building — can't determine neighbor distance
        return None

    # Compute distances and sort
    gdf["_dist"] = gdf.geometry.distance(point)
    sorted_gdf = gdf.sort_values("_dist")

    # The second row is the nearest neighbor (first is the user's own building)
    neighbor_dist_deg = sorted_gdf.iloc[1]["_dist"]
    neighbor_dist_m = round(neighbor_dist_deg * 111_320, 1)

    return neighbor_dist_m
