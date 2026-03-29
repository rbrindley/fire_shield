"""
Tests for app/jurisdiction/resolver.py :: _extract_jurisdiction_from_nominatim()

This is a pure function (no I/O, no async) that maps a Nominatim address
response dict to a Fire Shield jurisdiction code. It is the most failure-prone
part of the geocoding pipeline because Nominatim returns inconsistent field
names across address types (city/town/village/municipality).

Covers:
- Direct city name matches (Ashland, Jacksonville, Medford, etc.)
- Field variants: Nominatim may use 'city', 'town', or 'village'
- Partial/prefix matches: "City of Medford" → "medford"
- Space normalization: "Central Point" → "central_point"
- County fallback when city is unknown
- State fallback when county is also unknown
- Universal fallback when address dict is empty or fully unrecognized
- City wins over county when both are present
- Josephine vs Jackson County routing correctness

Does NOT test:
- geocode_address() HTTP call (Nominatim is an external service; use integration
  tests with VCR or mock httpx if needed)
- resolve_address() DB lookup (requires test_db fixture; add to integration tests)
"""

import pytest

from app.jurisdiction.resolver import _extract_jurisdiction_from_nominatim


def nominatim_result(
    city: str | None = None,
    town: str | None = None,
    village: str | None = None,
    county: str | None = None,
    state: str | None = None,
) -> dict:
    """Build a minimal Nominatim-style result dict for testing."""
    addr = {}
    if city is not None:
        addr["city"] = city
    if town is not None:
        addr["town"] = town
    if village is not None:
        addr["village"] = village
    if county is not None:
        addr["county"] = county
    if state is not None:
        addr["state"] = state
    return {"address": addr}


# ── Direct city matches ───────────────────────────────────────────────────────

@pytest.mark.parametrize("city_name,expected_code", [
    ("Ashland",       "ashland"),
    ("Jacksonville",  "jacksonville"),
    ("Medford",       "medford"),
    ("Talent",        "talent"),
    ("Phoenix",       "phoenix"),
    ("Eagle Point",   "eagle_point"),
    ("Grants Pass",   "grants_pass"),
])
def test_known_city_field_resolves_correctly(city_name, expected_code):
    """
    Each documented city name (as Nominatim returns it in the 'city' field)
    must resolve to its correct jurisdiction code.
    """
    result = nominatim_result(city=city_name, county="Jackson County", state="Oregon")
    assert _extract_jurisdiction_from_nominatim(result) == expected_code


def test_central_point_with_space_resolves():
    """
    'Central Point' contains a space. The lookup must match it to
    'central_point'. Space → underscore normalization happens via the
    CITY_TO_JURISDICTION dict key "central point".
    """
    result = nominatim_result(city="Central Point", county="Jackson County", state="Oregon")
    assert _extract_jurisdiction_from_nominatim(result) == "central_point"


# ── Nominatim field variant: 'town' instead of 'city' ────────────────────────

def test_town_field_resolves_when_city_absent():
    """
    Nominatim uses 'town' for some municipalities instead of 'city'.
    The resolver must check 'town' as a fallback when 'city' is absent.
    """
    result = nominatim_result(town="Jacksonville", county="Jackson County", state="Oregon")
    assert _extract_jurisdiction_from_nominatim(result) == "jacksonville"


def test_village_field_resolves_when_city_and_town_absent():
    """
    Small unincorporated communities may appear as 'village'.
    If the village name matches a known jurisdiction, it should resolve.
    """
    result = nominatim_result(village="Talent", county="Jackson County", state="Oregon")
    assert _extract_jurisdiction_from_nominatim(result) == "talent"


# ── Partial / prefix match ────────────────────────────────────────────────────

def test_partial_city_name_match():
    """
    Nominatim sometimes returns "City of Medford" instead of "Medford".
    The partial match logic must handle prefix/substring matches.
    """
    result = nominatim_result(city="City of Medford", county="Jackson County", state="Oregon")
    assert _extract_jurisdiction_from_nominatim(result) == "medford"


# ── County fallback ───────────────────────────────────────────────────────────

def test_unknown_city_falls_back_to_jackson_county():
    """
    An unrecognized city in Jackson County must fall back to 'jackson_county'.
    Covers rural and unincorporated areas like White City, Gold Hill.
    """
    result = nominatim_result(city="White City", county="Jackson County", state="Oregon")
    assert _extract_jurisdiction_from_nominatim(result) == "jackson_county"


def test_unknown_city_falls_back_to_josephine_county():
    """
    An unrecognized city in Josephine County must fall back to 'josephine_county',
    not 'jackson_county'. Cross-county fallback must route to the correct county.
    """
    result = nominatim_result(city="Cave Junction", county="Josephine County", state="Oregon")
    assert _extract_jurisdiction_from_nominatim(result) == "josephine_county"


# ── State fallback ────────────────────────────────────────────────────────────

def test_unknown_city_and_county_falls_back_to_oregon_state():
    """
    If neither city nor county is recognized, the resolver should fall back
    to 'oregon_state' when the state is Oregon.
    """
    result = nominatim_result(city="Unknown City", county="Unknown County", state="Oregon")
    assert _extract_jurisdiction_from_nominatim(result) == "oregon_state"


def test_oregon_in_state_field_triggers_oregon_fallback():
    """
    Nominatim may return "State of Oregon" or "Oregon" in the state field.
    The check uses substring matching ("oregon" in state.lower()).
    """
    result = nominatim_result(county="Unknown County", state="State of Oregon")
    assert _extract_jurisdiction_from_nominatim(result) == "oregon_state"


# ── Universal fallback ────────────────────────────────────────────────────────

def test_empty_address_returns_universal():
    """
    An empty address dict (e.g., Nominatim returned no structured fields)
    must return 'universal' — the safest fallback for unknown locations.
    """
    result = {"address": {}}
    assert _extract_jurisdiction_from_nominatim(result) == "universal"


def test_non_oregon_state_returns_universal():
    """
    A well-formed address outside Oregon (e.g., a test against a California
    address) must fall through all layers and return 'universal'.
    """
    result = nominatim_result(city="San Francisco", county="San Francisco County", state="California")
    assert _extract_jurisdiction_from_nominatim(result) == "universal"


# ── City wins over county when both present ───────────────────────────────────

def test_city_match_takes_priority_over_county_match():
    """
    When both a known city and county are present, city takes priority.
    'Grants Pass' (a known city) must resolve to 'grants_pass', not
    'josephine_county' (what the county fallback would give).
    """
    result = nominatim_result(city="Grants Pass", county="Josephine County", state="Oregon")
    assert _extract_jurisdiction_from_nominatim(result) == "grants_pass"
