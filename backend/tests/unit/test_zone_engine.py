"""
Tests for app/zone/engine.py

Covers:
- _apply_seasonal_boost(): verifies boost amounts for all combinations of
  season/layer/peak — this is the most critical scoring logic
- _season_from_month(): all 12 months map to the correct season
- get_zone_actions(): integration with real SQLite (uses test_db fixture),
  verifying response shape, layer completeness, sort order, and season override

Does NOT test:
- NWS weather alerts (covered by generate.py tests if added later)
- Jurisdiction-specific action filtering (actions are universal — filtering
  is handled by the RAG pipeline, not the zone engine)
"""

import json
import pytest

from app.zone.engine import (
    _apply_seasonal_boost,
    _season_from_month,
    FIRE_SEASON_MONTHS,
    get_zone_actions,
)
from tests.helpers.assertions import assert_valid_zone_response


# ── Helpers ──────────────────────────────────────────────────────────────────

def make_action(layer: int, seasonal_peak: list[str] | None = None) -> dict:
    """Build a minimal action dict for _apply_seasonal_boost tests."""
    return {
        "layer": layer,
        "seasonal_peak": json.dumps(seasonal_peak or []),
        "priority_score": 0.80,
    }


# ── _apply_seasonal_boost ─────────────────────────────────────────────────────

def test_seasonal_peak_match_non_fire_season_layer3():
    """
    Layer 3 action peaking in march, tested in march.
    Should get +0.15 seasonal boost only — Layer 3 is not fire-boosted.
    """
    action = make_action(layer=3, seasonal_peak=["march", "april"])
    boost = _apply_seasonal_boost(action, "march")
    assert boost == pytest.approx(0.15)


def test_fire_season_layer0_not_in_peak():
    """
    Layer 0 action with no seasonal peak, tested in july (fire season).
    Should get +0.10 fire season boost only — no seasonal peak match.
    """
    action = make_action(layer=0, seasonal_peak=[])
    boost = _apply_seasonal_boost(action, "july")
    assert boost == pytest.approx(0.10)


def test_fire_season_layer0_also_in_peak():
    """
    Layer 0 action peaking in june, tested in june (fire season).
    Should get +0.15 (peak match) + 0.10 (fire season layer 0/1) = +0.25.
    """
    action = make_action(layer=0, seasonal_peak=["june", "july"])
    boost = _apply_seasonal_boost(action, "june")
    assert boost == pytest.approx(0.25)


def test_fire_season_layer1_also_in_peak():
    """
    Layer 1 is included in the fire season boost (layers 0 AND 1).
    Verify the same +0.25 total applies to Layer 1.
    """
    action = make_action(layer=1, seasonal_peak=["august"])
    boost = _apply_seasonal_boost(action, "august")
    assert boost == pytest.approx(0.25)


def test_fire_season_month_layer2_gets_no_fire_boost():
    """
    Fire season boost only applies to layers 0 and 1.
    Layer 2 in fire season with no seasonal peak should get 0.0 boost.
    This guards against accidentally applying the boost to outer zones.
    """
    action = make_action(layer=2, seasonal_peak=[])
    boost = _apply_seasonal_boost(action, "july")
    assert boost == pytest.approx(0.0)


def test_non_fire_season_month_layer0_no_peak_no_boost():
    """
    Layer 0 action in december (winter, not fire season) with no seasonal peak.
    Zero boost — no conditions met.
    """
    action = make_action(layer=0, seasonal_peak=[])
    boost = _apply_seasonal_boost(action, "december")
    assert boost == pytest.approx(0.0)


def test_empty_seasonal_peak_gives_no_peak_boost():
    """
    Explicitly empty seasonal_peak (JSON '[]') should never match any month.
    Any boost seen here would be a bug in the JSON parsing logic.
    """
    action = make_action(layer=3, seasonal_peak=[])
    for month in ["january", "june", "october", "december"]:
        boost = _apply_seasonal_boost(action, month)
        assert boost == pytest.approx(0.0), (
            f"Expected 0 boost in {month} with empty peak, got {boost}"
        )


def test_null_seasonal_peak_handled_gracefully():
    """
    seasonal_peak can be NULL in the DB (stored as Python None).
    The engine must handle None without crashing and return 0 boost.
    """
    action = {"layer": 2, "seasonal_peak": None, "priority_score": 0.80}
    boost = _apply_seasonal_boost(action, "june")
    assert boost == pytest.approx(0.0)


def test_boost_is_not_capped_by_apply_seasonal_boost():
    """
    _apply_seasonal_boost returns the raw additive boost — it does NOT cap
    the result at 1.0. Capping is the caller's responsibility (get_zone_actions).
    Verify a 0.92 base + 0.25 boost = 0.25 returned (not 0.08).
    """
    action = make_action(layer=0, seasonal_peak=["june"])
    boost = _apply_seasonal_boost(action, "june")
    # boost itself is 0.25; the 0.92 base is not involved here
    assert boost == pytest.approx(0.25)


# ── _season_from_month ────────────────────────────────────────────────────────

@pytest.mark.parametrize("month,expected_season", [
    ("december", "winter"),
    ("january",  "winter"),
    ("february", "winter"),
    ("march",    "spring"),
    ("april",    "spring"),
    ("may",      "spring"),
    ("june",     "summer"),
    ("july",     "summer"),
    ("august",   "summer"),
    ("september","summer"),
    ("october",  "fall"),
    ("november", "fall"),
])
def test_season_from_month_all_months(month, expected_season):
    """
    All 12 months must map to the correct Southern Oregon season.
    The June–September fire season coincides with summer/fall boundary;
    fire season handling is in _apply_seasonal_boost, not here.
    """
    assert _season_from_month(month) == expected_season


def test_fire_season_months_constant_covers_june_through_september():
    """
    FIRE_SEASON_MONTHS must include exactly june, july, august, september.
    Expanding or contracting this set changes boost behavior across the app.
    """
    assert FIRE_SEASON_MONTHS == {"june", "july", "august", "september"}


# ── get_zone_actions (async, requires DB) ─────────────────────────────────────

@pytest.mark.asyncio
async def test_get_zone_actions_returns_valid_structure(test_db):
    """
    get_zone_actions() must return a dict that satisfies all structural
    invariants: 5 layers, required keys, actions sorted by effective_priority.
    Uses the shared assert_valid_zone_response helper.
    """
    result = await get_zone_actions()
    assert_valid_zone_response(result)


@pytest.mark.asyncio
async def test_get_zone_actions_summer_override(test_db):
    """
    Passing season='summer' must force current_season to 'summer' in the
    response regardless of the real calendar month.
    """
    result = await get_zone_actions(season="summer")
    assert result["current_season"] == "summer"


@pytest.mark.asyncio
async def test_get_zone_actions_winter_override(test_db):
    """
    Passing season='winter' must force current_season to 'winter'.
    Primarily used by admin UI and tests to simulate off-season conditions.
    """
    result = await get_zone_actions(season="winter")
    assert result["current_season"] == "winter"


@pytest.mark.asyncio
async def test_effective_priority_never_exceeds_1(test_db):
    """
    After seasonal boosting, effective_priority must be capped at 1.0.
    This prevents any action from scoring above the maximum regardless
    of how many boosts stack.
    """
    result = await get_zone_actions(season="summer")
    for layer in result["layers"]:
        for action in layer["actions"]:
            assert action["effective_priority"] <= 1.0, (
                f"Action '{action['action_title']}' has effective_priority "
                f"{action['effective_priority']} > 1.0"
            )


@pytest.mark.asyncio
async def test_all_17_actions_present(test_db):
    """
    The seed migration inserts exactly 17 zone actions. All must be
    returned — the engine does not filter by jurisdiction (actions are
    universal). If this fails, a migration may have been skipped.
    """
    result = await get_zone_actions()
    total = sum(len(layer["actions"]) for layer in result["layers"])
    assert total == 17, f"Expected 17 total actions, got {total}"


@pytest.mark.asyncio
async def test_layer_action_counts_match_spec(test_db):
    """
    The build spec defines 5/5/3/2/2 actions across layers 0–4.
    Verify the seeded data matches this distribution.
    """
    result = await get_zone_actions()
    expected = {0: 5, 1: 5, 2: 3, 3: 2, 4: 2}
    actual = {layer["layer"]: len(layer["actions"]) for layer in result["layers"]}
    assert actual == expected, f"Layer distribution mismatch: {actual}"


@pytest.mark.asyncio
async def test_neighbor_note_is_non_empty(test_db):
    """
    The neighbor_note must always be a non-empty string, as it is
    displayed on the Layer 2 ZoneCard regardless of input params.
    """
    result = await get_zone_actions()
    assert result["neighbor_note"]
    assert len(result["neighbor_note"]) > 20
