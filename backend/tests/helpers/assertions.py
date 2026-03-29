"""
Reusable assertion helpers for Fire Shield tests.

These functions encode structural invariants that hold across many tests.
Import them instead of duplicating the same assert blocks.
"""


def assert_valid_zone_response(data: dict) -> None:
    """
    Assert the canonical shape of a GET /api/zones/ response.

    Checks: required top-level keys, exactly 5 layers (0–4), each layer's
    required keys, and that actions within each layer are sorted by
    effective_priority descending.

    Does NOT assert specific action titles or scores — those are seed-data
    details that belong in focused unit tests.
    """
    assert "layers" in data, "Response missing 'layers' key"
    assert "neighbor_note" in data, "Response missing 'neighbor_note' key"
    assert "current_season" in data, "Response missing 'current_season' key"
    assert "current_month" in data, "Response missing 'current_month' key"

    layers = data["layers"]
    assert len(layers) == 5, f"Expected 5 layers, got {len(layers)}"

    layer_numbers = [layer["layer"] for layer in layers]
    assert layer_numbers == [0, 1, 2, 3, 4], f"Layers not in order 0–4: {layer_numbers}"

    for layer in layers:
        assert "layer" in layer
        assert "layer_name" in layer
        assert "layer_description" in layer
        assert "actions" in layer
        assert isinstance(layer["actions"], list)

        # Verify actions sorted by effective_priority descending
        priorities = [a["effective_priority"] for a in layer["actions"]]
        assert priorities == sorted(priorities, reverse=True), (
            f"Layer {layer['layer']} actions not sorted by effective_priority desc: {priorities}"
        )

    assert data["neighbor_note"], "neighbor_note should be a non-empty string"


def assert_chain_invariants(chain: list[str], code: str) -> None:
    """
    Assert structural invariants that every jurisdiction chain must satisfy.

    Invariants:
    1. Non-empty
    2. 'universal' is always the last element
    3. 'universal' appears exactly once
    4. No duplicate entries anywhere in the chain
    """
    assert chain, f"Chain for '{code}' is empty"
    assert chain[-1] == "universal", (
        f"Chain for '{code}' must end with 'universal', got: {chain}"
    )
    assert chain.count("universal") == 1, (
        f"Chain for '{code}' has {chain.count('universal')} occurrences of 'universal'"
    )
    assert len(chain) == len(set(chain)), (
        f"Chain for '{code}' has duplicates: {chain}"
    )


def assert_valid_plant_list(data: dict) -> None:
    """
    Assert the canonical shape of a GET /api/plants/search response.

    Checks: required top-level keys and that each plant record has the
    boolean fields converted from SQLite integers.

    Does NOT assert specific plant names or filter correctness — use
    focused filter tests for that.
    """
    assert "plants" in data, "Response missing 'plants' key"
    assert "total" in data, "Response missing 'total' key"
    assert "limit" in data, "Response missing 'limit' key"
    assert "offset" in data, "Response missing 'offset' key"
    assert isinstance(data["plants"], list)

    bool_fields = (
        "zone_0_5ft", "zone_5_30ft", "zone_30_100ft", "zone_100ft_plus",
        "is_native", "deer_resistant", "pollinator_support",
        "ashland_restricted", "is_noxious_weed",
    )
    for plant in data["plants"]:
        for field in bool_fields:
            assert isinstance(plant[field], bool), (
                f"Plant '{plant.get('common_name')}' field '{field}' is {type(plant[field])}, expected bool"
            )
