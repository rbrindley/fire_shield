"""
Tests for app/rag/smart_filter.py :: build_jurisdiction_chain()

Verifies:
- All 12 known jurisdiction codes produce the documented chain
- Structural invariants hold for every chain (non-empty, ends in 'universal', no dups)
- Cross-county bleed is absent (Josephine County cities never in Jackson County chains)
- Unknown/arbitrary codes fall back to DEFAULT_CHAIN without raising
- Chain ordering: city codes always start with the city, then contain the county

Does NOT test:
- DB lookups (build_jurisdiction_chain is a pure dict lookup)
- The resolver or any geocoding logic
"""

import pytest
from app.rag.smart_filter import build_jurisdiction_chain, DEFAULT_CHAIN
from tests.helpers.assertions import assert_chain_invariants


# ── Known jurisdiction → expected chain mapping ──────────────────────────────

KNOWN_CHAINS = {
    "ashland":        ["ashland", "jackson_county", "oregon_state", "federal", "universal"],
    "jacksonville":   ["jacksonville", "jackson_county", "oregon_state", "federal", "universal"],
    "medford":        ["medford", "jackson_county", "oregon_state", "federal", "universal"],
    "talent":         ["talent", "jackson_county", "oregon_state", "federal", "universal"],
    "phoenix":        ["phoenix", "jackson_county", "oregon_state", "federal", "universal"],
    "central_point":  ["central_point", "jackson_county", "oregon_state", "federal", "universal"],
    "eagle_point":    ["eagle_point", "jackson_county", "oregon_state", "federal", "universal"],
    "jackson_county": ["jackson_county", "oregon_state", "federal", "universal"],
    "josephine_county": ["josephine_county", "oregon_state", "federal", "universal"],
    "grants_pass":    ["grants_pass", "josephine_county", "oregon_state", "federal", "universal"],
    "oregon_state":   ["oregon_state", "federal", "universal"],
    "universal":      ["universal"],
}

JACKSON_COUNTY_CITIES = [
    "ashland", "jacksonville", "medford", "talent",
    "phoenix", "central_point", "eagle_point",
]

JOSEPHINE_COUNTY_CITIES = ["grants_pass"]


@pytest.mark.parametrize("code,expected", list(KNOWN_CHAINS.items()))
def test_known_code_returns_exact_chain(code, expected):
    """
    Each documented jurisdiction code produces exactly its specified chain.
    Tests both city-level and county/state codes.
    """
    assert build_jurisdiction_chain(code) == expected


@pytest.mark.parametrize("code", list(KNOWN_CHAINS.keys()))
def test_all_chains_satisfy_invariants(code):
    """
    Every chain must be non-empty, end with 'universal', and have no duplicates.
    Uses the shared assert_chain_invariants helper.
    """
    chain = build_jurisdiction_chain(code)
    assert_chain_invariants(chain, code)


@pytest.mark.parametrize("city", JACKSON_COUNTY_CITIES)
def test_jackson_county_city_chain_starts_with_city(city):
    """
    Jackson County city codes must have the city as chain[0] and
    jackson_county as chain[1]. This ensures city-level docs rank
    above county docs during retrieval.
    """
    chain = build_jurisdiction_chain(city)
    assert chain[0] == city, f"Expected chain[0]=={city}, got {chain[0]}"
    assert chain[1] == "jackson_county", f"Expected chain[1]=='jackson_county', got {chain[1]}"


@pytest.mark.parametrize("city", JACKSON_COUNTY_CITIES)
def test_jackson_county_cities_never_contain_josephine_county(city):
    """
    Cross-county bleed check: no Jackson County city should pull in
    Josephine County docs. If 'josephine_county' ever appears in these
    chains, Grants Pass/Cave Junction docs would appear for Ashland queries.
    """
    chain = build_jurisdiction_chain(city)
    assert "josephine_county" not in chain, (
        f"Chain for '{city}' incorrectly contains 'josephine_county': {chain}"
    )


def test_grants_pass_contains_josephine_not_jackson():
    """
    grants_pass sits in Josephine County. Its chain must include
    josephine_county (not jackson_county) to avoid routing Josephine
    County residents to Jackson County ordinances.
    """
    chain = build_jurisdiction_chain("grants_pass")
    assert "josephine_county" in chain
    assert "jackson_county" not in chain


def test_jackson_county_chain_does_not_contain_josephine():
    """
    The jackson_county chain should not include josephine_county,
    since they are sibling counties — neither is a parent of the other.
    """
    chain = build_jurisdiction_chain("jackson_county")
    assert "josephine_county" not in chain


def test_unknown_code_returns_default_chain():
    """
    Unrecognized codes (e.g., a new city not yet mapped) must return
    DEFAULT_CHAIN without raising. The default chain provides sensible
    fallback coverage (county + state + federal + universal).
    """
    result = build_jurisdiction_chain("nonexistent_city_xyz")
    assert result == DEFAULT_CHAIN


def test_default_chain_is_non_empty_and_ends_with_universal():
    """
    The DEFAULT_CHAIN itself must satisfy all chain invariants, since it
    is used as the fallback for any unrecognized jurisdiction.
    """
    assert_chain_invariants(DEFAULT_CHAIN, "DEFAULT_CHAIN")


def test_universal_code_returns_single_element_chain():
    """
    'universal' is the base of all jurisdiction hierarchies.
    Its chain contains only itself — including other elements would
    create circular or redundant lookups.
    """
    chain = build_jurisdiction_chain("universal")
    assert chain == ["universal"]
    assert len(chain) == 1
