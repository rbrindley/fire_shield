"""LWF (Living with Fire) plant API adapter.

Fetches plants from https://lwf-api.vercel.app/api/v2 and normalizes them
to the Fire Shield canonical schema for storage in the plants table.

API pattern: GET /api/v2/plants?attributeIds=<list>&includeImages=true
Returns plants with inline resolved attribute values.
"""

import asyncio
import logging
from datetime import datetime, timezone

import httpx

from app.config import get_settings
from app.config.database import get_db

settings = get_settings()
logger = logging.getLogger(__name__)

LWF_API_BASE = "https://lwf-api.vercel.app/api/v2"

# Attribute UUIDs confirmed from lwf-plant-fields.json
ATTRIBUTE_IDS = [
    "b908b170-70c9-454d-a2ed-d86f98cb3de1",  # Home Ignition Zone (HIZ)
    "70dcbd81-352d-4678-8d8a-f3bd51f1bab6",  # Character Score
    "d9174148-6563-4f92-9673-01feb6a529ce",  # Water Amount
    "d5fb9f61-41dd-4e4e-bc5e-47eb24ecab46",  # Oregon Native
    "ff4c4d0e-35d5-4804-aea3-2a6334ef8cb5",  # Deer Resistance
    "7096a9cc-3435-4e14-a1c4-eb9e95f0850f",  # Light Needs
    "ff75e529-5b5c-4461-8191-0382e33a4bd5",  # Benefits (wildlife/pollinator)
    "7692e4d8-9e4d-42b2-bdf3-5b386feeecfb",  # Max Mature Height
    "1ddbe951-69ef-4b4b-aa20-75b97cb0207c",  # Ashland restrictions
    "a0900c7f-3bb3-4757-9dec-075f718c8f3e",  # Invasive Qualities
    "34b147da-613b-4df7-8eb9-76fd10e1d7ae",  # Flammability Notes
    "ef9be401-1500-471b-bf8f-b11936d6d047",  # Shrub
    "d5673c20-6fb7-49e3-b7e3-d056caf8d205",  # Tree
    "82f68242-238f-4567-bb47-90da80b5c338",  # Groundcover
]

# Ashland restriction codes that are prohibitions (not just placement categories)
ASHLAND_PROHIBITED_CODES = {"NW", "Weed"}


def _normalize_plant(raw: dict) -> dict | None:
    """Normalize a raw LWF API plant record into Fire Shield canonical schema.

    Returns None if the plant should be excluded (e.g. missing common name).
    """
    plant_id = raw.get("id")
    common_name = raw.get("commonName", "").strip()
    if not plant_id or not common_name:
        return None

    genus = raw.get("genus", "")
    species = raw.get("species", "")
    scientific_name = f"{genus} {species}".strip() if genus or species else None

    # Extract attribute values — keyed by attributeId
    values_by_attr: dict[str, list[dict]] = {}
    for val in raw.get("values", []):
        attr_id = val.get("attributeId")
        if attr_id:
            values_by_attr.setdefault(attr_id, []).append(val)

    def get_raw(attr_id: str) -> list[str]:
        return [v.get("rawValue", "") for v in values_by_attr.get(attr_id, [])]

    def get_resolved(attr_id: str) -> list[str]:
        return [
            v.get("resolved", {}).get("value", "") or v.get("rawValue", "")
            for v in values_by_attr.get(attr_id, [])
        ]

    # --- HIZ zone eligibility ---
    # b908b170: rawValue "01"=0-5ft, "02"=5-30ft moderate, "03"=5-30ft aggressive,
    #           "04"=30-100ft, "05"=50-100ft
    hiz_raw = get_raw("b908b170-70c9-454d-a2ed-d86f98cb3de1")
    zone_0_5ft = "01" in hiz_raw
    zone_5_30ft = any(v in hiz_raw for v in ("02", "03"))
    zone_30_100ft = "04" in hiz_raw
    zone_100ft_plus = "05" in hiz_raw

    # --- Water need ---
    # d9174148: "01"=high, "02"=medium, "03"/"04"/"05"=low
    water_raw = get_raw("d9174148-6563-4f92-9673-01feb6a529ce")
    water_need = None
    if water_raw:
        w = water_raw[0]
        if w == "01":
            water_need = "high"
        elif w == "02":
            water_need = "medium"
        elif w in ("03", "04", "05"):
            water_need = "low"

    # --- Oregon native ---
    # d5fb9f61: rawValue "03" = Yes
    native_raw = get_raw("d5fb9f61-41dd-4e4e-bc5e-47eb24ecab46")
    is_native = "03" in native_raw

    # --- Deer resistance ---
    # ff4c4d0e: rawValue "04" or "05" = resistant
    deer_raw = get_raw("ff4c4d0e-35d5-4804-aea3-2a6334ef8cb5")
    deer_resistant = any(v in deer_raw for v in ("04", "05"))

    # --- Pollinator support ---
    # ff75e529: rawValue "01"/"02"/"03" = various wildlife benefits including pollinators
    pollinator_raw = get_raw("ff75e529-5b5c-4461-8191-0382e33a4bd5")
    pollinator_support = any(v in pollinator_raw for v in ("01", "02", "03"))

    # --- Light needs ---
    # 7096a9cc: "01"=full, "02"=partial, "03"=shade
    light_raw = get_raw("7096a9cc-3435-4e14-a1c4-eb9e95f0850f")
    sun = None
    if light_raw:
        mapping = {"01": "full", "02": "partial", "03": "shade"}
        sun = mapping.get(light_raw[0])

    # --- Max mature height ---
    # 7692e4d8: numeric feet
    height_vals = values_by_attr.get("7692e4d8-9e4d-42b2-bdf3-5b386feeecfb", [])
    mature_height_max_ft = None
    mature_height_min_ft = None
    if height_vals:
        try:
            mature_height_max_ft = float(height_vals[0].get("rawValue", 0) or 0) or None
        except (ValueError, TypeError):
            pass

    # --- Ashland restrictions ---
    # 1ddbe951: any non-null value = restricted; NW/Weed = prohibited
    ashland_vals = values_by_attr.get("1ddbe951-69ef-4b4b-aa20-75b97cb0207c", [])
    ashland_restricted = len(ashland_vals) > 0
    ashland_restriction_type = None
    if ashland_vals:
        ashland_restriction_type = ashland_vals[0].get("rawValue") or ashland_vals[0].get("resolved", {}).get("value")

    # --- Noxious weed ---
    # a0900c7f: rawValue "02" = noxious weed in Oregon
    invasive_raw = get_raw("a0900c7f-3bb3-4757-9dec-075f718c8f3e")
    is_noxious_weed = "02" in invasive_raw

    # --- Flammability notes ---
    fire_notes_vals = values_by_attr.get("34b147da-613b-4df7-8eb9-76fd10e1d7ae", [])
    fire_behavior_notes = None
    if fire_notes_vals:
        fire_behavior_notes = fire_notes_vals[0].get("resolved", {}).get("value") or fire_notes_vals[0].get("rawValue")

    # --- Plant type ---
    plant_type = None
    if values_by_attr.get("d5673c20-6fb7-49e3-b7e3-d056caf8d205"):
        plant_type = "tree"
    elif values_by_attr.get("ef9be401-1500-471b-bf8f-b11936d6d047"):
        plant_type = "shrub"
    elif values_by_attr.get("82f68242-238f-4567-bb47-90da80b5c338"):
        plant_type = "groundcover"

    # --- Source URL ---
    urls = raw.get("urls", [])
    source_url = urls[0] if urls else None

    # Primary image
    primary_image = raw.get("primaryImage")
    primary_image_url = primary_image.get("url") if primary_image else None

    return {
        "id": plant_id,
        "common_name": common_name,
        "scientific_name": scientific_name,
        "plant_type": plant_type,
        "zone_0_5ft": int(zone_0_5ft),
        "zone_5_30ft": int(zone_5_30ft),
        "zone_30_100ft": int(zone_30_100ft),
        "zone_100ft_plus": int(zone_100ft_plus),
        "water_need": water_need,
        "is_native": int(is_native),
        "deer_resistant": int(deer_resistant),
        "pollinator_support": int(pollinator_support),
        "sun": sun,
        "mature_height_min_ft": mature_height_min_ft,
        "mature_height_max_ft": mature_height_max_ft,
        "fire_behavior_notes": fire_behavior_notes,
        "placement_notes": None,
        "ashland_restricted": int(ashland_restricted),
        "ashland_restriction_type": ashland_restriction_type,
        "is_noxious_weed": int(is_noxious_weed),
        "primary_image_url": primary_image_url,
        "source": "lwf",
        "source_url": source_url,
        "last_synced": datetime.now(timezone.utc).isoformat(),
    }


async def sync_lwf_plants() -> dict:
    """Fetch all plants from LWF API and upsert into the plants table.

    Returns summary: {"upserted": n, "skipped": n, "errors": n}
    """
    attribute_ids_param = ",".join(ATTRIBUTE_IDS)
    url = f"{LWF_API_BASE}/plants"
    params = {
        "attributeIds": attribute_ids_param,
        "includeImages": "true",
        "limit": 500,
        "offset": 0,
    }

    all_plants = []
    async with httpx.AsyncClient(timeout=60.0) as client:
        while True:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()

            # API may return list or {plants: [...], total: n}
            if isinstance(data, list):
                batch = data
                has_more = False
            else:
                batch = data.get("plants", data.get("data", []))
                total = data.get("total", len(batch))
                has_more = (params["offset"] + len(batch)) < total

            all_plants.extend(batch)
            logger.info("Fetched %d plants (total so far: %d)", len(batch), len(all_plants))

            if not has_more or not batch:
                break
            params["offset"] += len(batch)

    upserted = 0
    skipped = 0
    errors = 0
    now = datetime.now(timezone.utc).isoformat()

    async with get_db() as db:
        for raw in all_plants:
            try:
                plant = _normalize_plant(raw)
                if plant is None:
                    skipped += 1
                    continue

                await db.execute(
                    """
                    INSERT INTO plants (
                        id, common_name, scientific_name, plant_type,
                        zone_0_5ft, zone_5_30ft, zone_30_100ft, zone_100ft_plus,
                        water_need, is_native, deer_resistant, pollinator_support,
                        sun, mature_height_min_ft, mature_height_max_ft,
                        fire_behavior_notes, placement_notes,
                        ashland_restricted, ashland_restriction_type,
                        is_noxious_weed, primary_image_url,
                        source, source_url, last_synced
                    ) VALUES (
                        :id, :common_name, :scientific_name, :plant_type,
                        :zone_0_5ft, :zone_5_30ft, :zone_30_100ft, :zone_100ft_plus,
                        :water_need, :is_native, :deer_resistant, :pollinator_support,
                        :sun, :mature_height_min_ft, :mature_height_max_ft,
                        :fire_behavior_notes, :placement_notes,
                        :ashland_restricted, :ashland_restriction_type,
                        :is_noxious_weed, :primary_image_url,
                        :source, :source_url, :last_synced
                    )
                    ON CONFLICT(id) DO UPDATE SET
                        common_name = excluded.common_name,
                        scientific_name = excluded.scientific_name,
                        plant_type = excluded.plant_type,
                        zone_0_5ft = excluded.zone_0_5ft,
                        zone_5_30ft = excluded.zone_5_30ft,
                        zone_30_100ft = excluded.zone_30_100ft,
                        zone_100ft_plus = excluded.zone_100ft_plus,
                        water_need = excluded.water_need,
                        is_native = excluded.is_native,
                        deer_resistant = excluded.deer_resistant,
                        pollinator_support = excluded.pollinator_support,
                        sun = excluded.sun,
                        mature_height_min_ft = excluded.mature_height_min_ft,
                        mature_height_max_ft = excluded.mature_height_max_ft,
                        fire_behavior_notes = excluded.fire_behavior_notes,
                        ashland_restricted = excluded.ashland_restricted,
                        ashland_restriction_type = excluded.ashland_restriction_type,
                        is_noxious_weed = excluded.is_noxious_weed,
                        primary_image_url = excluded.primary_image_url,
                        source_url = excluded.source_url,
                        last_synced = excluded.last_synced
                    """,
                    plant,
                )
                upserted += 1
            except Exception as e:
                logger.error("Error processing plant %s: %s", raw.get("id"), e)
                errors += 1

        # Record sync in plant_sync_log
        await db.execute(
            """
            INSERT INTO plant_sync_log (synced_at, plants_upserted, plants_skipped, errors, status)
            VALUES (?, ?, ?, ?, ?)
            """,
            (now, upserted, skipped, errors, "success" if errors == 0 else "partial"),
        )
        await db.commit()

    return {"upserted": upserted, "skipped": skipped, "errors": errors, "total_fetched": len(all_plants)}
