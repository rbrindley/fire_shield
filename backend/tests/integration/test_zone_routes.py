"""
Integration tests for GET /api/zones/ and GET /api/zones/top

Tests the full HTTP → FastAPI → zone engine → SQLite → response stack
using a real (but isolated) SQLite database with all migrations applied.

Covers:
- Response shape and structural invariants
- Season query-param override
- Top actions endpoint: default count, custom count, boundary validation

Does NOT test:
- Seasonal boost math (unit-tested in test_zone_engine.py)
- Jurisdiction-specific filtering (actions are universal, no filtering in zones)
- Admin zone-edit endpoints (covered separately if admin tests are added)
"""

import pytest

from tests.helpers.assertions import assert_valid_zone_response


@pytest.mark.asyncio
async def test_zone_actions_returns_200_and_valid_structure(app_client):
    """
    GET /api/zones/ must return 200 with a body that satisfies all
    structural invariants: 5 layers, required keys, sorted actions.
    """
    response = await app_client.get("/api/zones/")
    assert response.status_code == 200
    assert_valid_zone_response(response.json())


@pytest.mark.asyncio
async def test_zone_actions_default_season_is_string(app_client):
    """
    current_season in the response must be one of the four valid seasons.
    The default season is derived from the current calendar month.
    """
    response = await app_client.get("/api/zones/")
    data = response.json()
    assert data["current_season"] in {"spring", "summer", "fall", "winter"}


@pytest.mark.asyncio
async def test_zone_actions_season_summer_override(app_client):
    """
    ?season=summer must force current_season='summer' in the response
    regardless of the server's current date.
    """
    response = await app_client.get("/api/zones/?season=summer")
    assert response.status_code == 200
    assert response.json()["current_season"] == "summer"


@pytest.mark.asyncio
async def test_zone_actions_season_winter_override(app_client):
    """
    ?season=winter must force current_season='winter'. Used by tests and
    admin tooling to simulate off-season conditions.
    """
    response = await app_client.get("/api/zones/?season=winter")
    assert response.status_code == 200
    assert response.json()["current_season"] == "winter"


@pytest.mark.asyncio
async def test_zone_actions_contains_all_17_seeded_actions(app_client):
    """
    All 17 seed actions (from 003_seed_zone_actions.sql) must appear in the
    response. The zone engine does not filter by jurisdiction.
    """
    response = await app_client.get("/api/zones/")
    layers = response.json()["layers"]
    total = sum(len(layer["actions"]) for layer in layers)
    assert total == 17, f"Expected 17 total actions, got {total}"


@pytest.mark.asyncio
async def test_zone_actions_layer0_has_5_actions(app_client):
    """
    Layer 0 must have exactly 5 actions per the spec (5/5/3/2/2 distribution).
    If this fails, a seed migration may have been partially applied.
    """
    response = await app_client.get("/api/zones/")
    layer0 = response.json()["layers"][0]
    assert layer0["layer"] == 0
    assert len(layer0["actions"]) == 5


@pytest.mark.asyncio
async def test_zone_actions_with_jurisdiction_param(app_client):
    """
    ?jurisdiction=ashland must still return all 17 actions — jurisdiction
    annotates the response metadata but does not filter zone actions.
    """
    response = await app_client.get("/api/zones/?jurisdiction=ashland")
    assert response.status_code == 200
    data = response.json()
    assert data["jurisdiction_code"] == "ashland"
    total = sum(len(layer["actions"]) for layer in data["layers"])
    assert total == 17


@pytest.mark.asyncio
async def test_top_actions_default_returns_3(app_client):
    """
    GET /api/zones/top returns the top 3 actions by default.
    Each action must have the required keys for the property overview card.
    """
    response = await app_client.get("/api/zones/top")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3

    required_keys = {"layer", "action_title", "effective_priority"}
    for action in data:
        missing = required_keys - set(action.keys())
        assert not missing, f"Action missing keys: {missing}"


@pytest.mark.asyncio
async def test_top_actions_custom_n(app_client):
    """
    ?n=5 must return exactly 5 actions, all with effective_priority > 0.
    """
    response = await app_client.get("/api/zones/top?n=5")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 5
    for action in data:
        assert action["effective_priority"] > 0


@pytest.mark.asyncio
async def test_top_actions_n_1_returns_single_action(app_client):
    """
    ?n=1 returns exactly 1 action — the highest-priority action across
    all layers. Used by minimal property overview displays.
    """
    response = await app_client.get("/api/zones/top?n=1")
    assert response.status_code == 200
    assert len(response.json()) == 1


@pytest.mark.asyncio
async def test_top_actions_n_0_returns_422(app_client):
    """
    ?n=0 violates the ge=1 validation constraint and must return 422.
    Prevents empty-list edge cases in calling code.
    """
    response = await app_client.get("/api/zones/top?n=0")
    assert response.status_code == 422
