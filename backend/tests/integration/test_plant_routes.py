"""
Integration tests for GET /api/plants/search

Tests the full HTTP → FastAPI → SQLite filter stack against the 5 test
plants seeded by integration/conftest.py.

Seed summary (for reference):
  plant-1  Oregon White Oak    native  zone_5_30ft         not noxious
  plant-2  Pacific Madrone     native  no zone eligibility not noxious
  plant-3  Manzanita           native  zone_0_5ft+5_30ft   not noxious
  plant-4  English Ivy         non-native zone_0_5ft+5_30ft not noxious
  plant-5  Himalayan Blackberry non-native zone_5_30ft     NOXIOUS WEED

Note: exclude_noxious defaults to True in the API, so plant-5 is
excluded from all tests unless explicitly requested.

Covers:
- Response shape (boolean field conversion from SQLite integers)
- native=true / native=false filters
- zone=zone_0_5ft filter
- Combined filters narrow results correctly
- Default exclude_noxious behavior

Does NOT test:
- Natural language query search (text LIKE matching — integration with a real
  populated DB is needed; covered by manual QA or future E2E tests)
- Pagination (offset/limit logic is standard SQLite; tested indirectly via limit)
- Admin plant-override endpoints
"""

import pytest

from tests.helpers.assertions import assert_valid_plant_list


@pytest.mark.asyncio
async def test_search_returns_200_and_valid_shape(app_client):
    """
    GET /api/plants/search with no filters must return 200 and a valid
    response shape with boolean fields properly converted.
    """
    response = await app_client.get("/api/plants/search")
    assert response.status_code == 200
    assert_valid_plant_list(response.json())


@pytest.mark.asyncio
async def test_noxious_weed_excluded_by_default(app_client):
    """
    The default exclude_noxious=True must omit plant-5 (Himalayan Blackberry).
    If it appears, the default filter is broken.
    """
    response = await app_client.get("/api/plants/search")
    names = [p["common_name"] for p in response.json()["plants"]]
    assert "Himalayan Blackberry" not in names, (
        "Noxious weed should be excluded by default (exclude_noxious=True)"
    )


@pytest.mark.asyncio
async def test_noxious_weed_included_when_explicitly_requested(app_client):
    """
    exclude_noxious=false must include plant-5 (Himalayan Blackberry).
    Operators may need to see all plants including noxious weeds.
    """
    response = await app_client.get("/api/plants/search?exclude_noxious=false")
    names = [p["common_name"] for p in response.json()["plants"]]
    assert "Himalayan Blackberry" in names


@pytest.mark.asyncio
async def test_native_true_filter(app_client):
    """
    native=true must return only native plants (plants 1, 2, 3).
    English Ivy (non-native) must not appear. Himalayan Blackberry is
    excluded by default noxious filter.
    """
    response = await app_client.get("/api/plants/search?native=true")
    data = response.json()
    assert response.status_code == 200
    assert len(data["plants"]) > 0, "Expected at least one native plant"
    for plant in data["plants"]:
        assert plant["is_native"] is True, (
            f"Plant '{plant['common_name']}' has is_native=False in native=true results"
        )


@pytest.mark.asyncio
async def test_native_false_returns_all_plants(app_client):
    """
    native=false is the default — it means 'do not filter by native status',
    NOT 'return only non-native plants'. All plants (native and non-native)
    should appear. This is the route's documented behavior: the filter is
    additive-only (native=true adds a WHERE clause; false removes it).
    """
    response_filtered = await app_client.get("/api/plants/search?native=true")
    response_unfiltered = await app_client.get("/api/plants/search?native=false")
    assert response_unfiltered.status_code == 200
    # Unfiltered must return at least as many plants as native-only filter
    assert response_unfiltered.json()["total"] >= response_filtered.json()["total"]


@pytest.mark.asyncio
async def test_zone_0_5ft_filter(app_client):
    """
    zone=zone_0_5ft must return only plants with zone_0_5ft=True.
    From seed data: plant-3 (Manzanita) and plant-4 (English Ivy).
    Pacific Madrone and Oregon White Oak are NOT zone_0_5ft eligible.
    """
    response = await app_client.get("/api/plants/search?zone=zone_0_5ft")
    data = response.json()
    assert response.status_code == 200
    assert len(data["plants"]) >= 1, "Expected at least one zone_0_5ft plant"
    for plant in data["plants"]:
        assert plant["zone_0_5ft"] is True, (
            f"Plant '{plant['common_name']}' has zone_0_5ft=False in zone filter results"
        )


@pytest.mark.asyncio
async def test_zone_5_30ft_filter(app_client):
    """
    zone=zone_5_30ft must return all plants with zone_5_30ft=True.
    From seed: plant-1 (Oak), plant-3 (Manzanita), plant-4 (Ivy).
    """
    response = await app_client.get("/api/plants/search?zone=zone_5_30ft")
    data = response.json()
    assert response.status_code == 200
    for plant in data["plants"]:
        assert plant["zone_5_30ft"] is True


@pytest.mark.asyncio
async def test_invalid_zone_param_returns_all_results(app_client):
    """
    An unrecognized zone value (not in valid_zones set) must be ignored,
    returning all plants rather than erroring. The route silently drops
    invalid zone filters.
    """
    response = await app_client.get("/api/plants/search?zone=invalid_zone_name")
    all_response = await app_client.get("/api/plants/search")
    assert response.status_code == 200
    # Should return same count as unfiltered (invalid zone is dropped)
    assert response.json()["total"] == all_response.json()["total"]


@pytest.mark.asyncio
async def test_combined_native_and_zone_filter(app_client):
    """
    Combining native=true&zone=zone_0_5ft must return the intersection:
    only plants that are both native AND zone_0_5ft eligible.
    From seed: only Manzanita (plant-3) satisfies both conditions.
    """
    response = await app_client.get("/api/plants/search?native=true&zone=zone_0_5ft")
    data = response.json()
    assert response.status_code == 200
    for plant in data["plants"]:
        assert plant["is_native"] is True
        assert plant["zone_0_5ft"] is True


@pytest.mark.asyncio
async def test_total_count_reflects_filter(app_client):
    """
    The 'total' field in the response must reflect the filtered count,
    not the total number of plants in the database.
    """
    response_native = await app_client.get("/api/plants/search?native=true")
    response_all = await app_client.get("/api/plants/search")

    total_native = response_native.json()["total"]
    total_all = response_all.json()["total"]

    assert total_native < total_all, (
        f"native=true should return fewer results ({total_native}) than unfiltered ({total_all})"
    )
