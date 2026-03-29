"""Zone engine: returns prioritized HIZ actions with seasonal weighting."""

import json
import logging
from datetime import datetime
from typing import Any

from app.config.database import get_db

logger = logging.getLogger(__name__)

LAYER_NAMES = {
    0: "The House Itself",
    1: "0–5 Feet (Noncombustible Zone)",
    2: "5–30 Feet (Lean, Clean, Green)",
    3: "30–100 Feet (Reduced Fuel Zone)",
    4: "100+ Feet (Access & Community)",
}

LAYER_DESCRIPTIONS = {
    0: "The structure itself — vents, gutters, eaves, attached decks, garage. This is where most homes are lost.",
    1: "The ember landing zone. What ignites here ignites the house. Noncombustible materials only.",
    2: "Landscaping management zone. Interrupt vertical and horizontal fire pathways.",
    3: "Transition zone. Keep flames small and on the ground before they reach inner zones.",
    4: "Access and community zone. Primarily relevant for rural and hillside properties.",
}

# Months in Southern Oregon fire season get a general urgency boost
FIRE_SEASON_MONTHS = {"june", "july", "august", "september"}

MONTH_NAMES = {
    1: "january", 2: "february", 3: "march", 4: "april",
    5: "may", 6: "june", 7: "july", 8: "august",
    9: "september", 10: "october", 11: "november", 12: "december",
}


def _current_month() -> str:
    return MONTH_NAMES[datetime.now().month]


def _season_from_month(month: str) -> str:
    seasons = {
        "december": "winter", "january": "winter", "february": "winter",
        "march": "spring", "april": "spring", "may": "spring",
        "june": "summer", "july": "summer", "august": "summer",
        "september": "summer", "october": "fall", "november": "fall",
    }
    return seasons.get(month, "spring")


def _apply_seasonal_boost(action: dict, current_month: str) -> float:
    """Return a seasonal boost factor for this action."""
    seasonal_peak = json.loads(action.get("seasonal_peak") or "[]")
    boost = 0.0

    if current_month in seasonal_peak:
        boost += 0.15

    # Fire season general boost for Layer 0 and Layer 1
    if current_month in FIRE_SEASON_MONTHS and action["layer"] in (0, 1):
        boost += 0.10

    return boost


async def get_zone_actions(
    jurisdiction_code: str | None = None,
    season: str | None = None,
) -> dict[str, Any]:
    """
    Return all 17 zone actions organized by layer, with seasonal boosting applied.

    Args:
        jurisdiction_code: Used to annotate response (no action filtering needed — actions are universal).
        season: 'spring', 'summer', 'fall', 'winter'. Defaults to current season.

    Returns structured dict with layers array.
    """
    current_month = _current_month()
    current_season = season or _season_from_month(current_month)

    async with get_db() as db:
        cursor = await db.execute(
            """SELECT * FROM zone_actions ORDER BY layer ASC, rank_in_layer ASC"""
        )
        rows = [dict(r) for r in await cursor.fetchall()]

    # Apply seasonal boosts and compute effective priority
    for action in rows:
        boost = _apply_seasonal_boost(action, current_month)
        action["effective_priority"] = min(1.0, action["priority_score"] + boost)
        action["seasonal_boost"] = boost
        action["is_seasonal_peak"] = current_month in json.loads(action.get("seasonal_peak") or "[]")

    # Group by layer
    layers: dict[int, list] = {i: [] for i in range(5)}
    for action in rows:
        layers[action["layer"]].append(action)

    # Sort within each layer by effective priority
    for layer_num in layers:
        layers[layer_num].sort(key=lambda a: a["effective_priority"], reverse=True)

    result_layers = []
    for layer_num in range(5):
        result_layers.append({
            "layer": layer_num,
            "layer_name": LAYER_NAMES[layer_num],
            "layer_description": LAYER_DESCRIPTIONS[layer_num],
            "actions": layers[layer_num],
        })

    return {
        "jurisdiction_code": jurisdiction_code or "universal",
        "current_season": current_season,
        "current_month": current_month,
        "layers": result_layers,
        "neighbor_note": (
            "Your defensible space effectiveness depends on neighboring properties too. "
            "In the Camp Fire, 73% of destroyed homes had a burning structure within 59 feet. "
            "Working with neighbors multiplies your protection."
        ),
    }


async def get_top_actions(n: int = 3) -> list[dict[str, Any]]:
    """Return top N actions across all layers by effective priority (for property overview)."""
    result = await get_zone_actions()
    all_actions = []
    for layer in result["layers"]:
        all_actions.extend(layer["actions"])
    all_actions.sort(key=lambda a: a["effective_priority"], reverse=True)
    return all_actions[:n]
