"""Jurisdiction chain filtering for RAG queries.

Replaces the X12 document hierarchy filter with wildfire jurisdiction chains.
The chain ensures city-level docs take precedence, falling back to county,
state, federal, and universal guidance in that order.
"""


JURISDICTION_CHAINS: dict[str, list[str]] = {
    "ashland":       ["ashland", "jackson_county", "oregon_state", "federal", "universal"],
    "jacksonville":  ["jacksonville", "jackson_county", "oregon_state", "federal", "universal"],
    "medford":       ["medford", "jackson_county", "oregon_state", "federal", "universal"],
    "talent":        ["talent", "jackson_county", "oregon_state", "federal", "universal"],
    "phoenix":       ["phoenix", "jackson_county", "oregon_state", "federal", "universal"],
    "central_point": ["central_point", "jackson_county", "oregon_state", "federal", "universal"],
    "eagle_point":   ["eagle_point", "jackson_county", "oregon_state", "federal", "universal"],
    "jackson_county":   ["jackson_county", "oregon_state", "federal", "universal"],
    "josephine_county": ["josephine_county", "oregon_state", "federal", "universal"],
    "grants_pass":   ["grants_pass", "josephine_county", "oregon_state", "federal", "universal"],
    "oregon_state":  ["oregon_state", "federal", "universal"],
    "federal":       ["federal", "universal"],
    "universal":     ["universal"],
}

DEFAULT_CHAIN = ["jackson_county", "oregon_state", "federal", "universal"]


def build_jurisdiction_chain(jurisdiction_code: str) -> list[str]:
    """Return the full jurisdiction chain for a given code.

    Example:
        build_jurisdiction_chain("ashland")
        → ["ashland", "jackson_county", "oregon_state", "federal", "universal"]
    """
    return JURISDICTION_CHAINS.get(jurisdiction_code, DEFAULT_CHAIN)
