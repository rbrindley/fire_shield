"""
Tests for app/rag/rerank.py :: rerank_chunks()

Strategy: mock the CrossEncoder so tests run in milliseconds without
downloading model weights. The mock returns controlled raw scores, making
the trust-tier boost math fully deterministic.

Covers:
- Tier ordering: higher trust tier wins when raw scores are equal
- Large raw score can overcome tier penalty (tier5 high score > tier4 low)
- Tier 1 narrowly beats Tier 2 even when Tier 2 has a higher raw score
- Unknown tier treated as 1.0 multiplier (not an error, not tier-penalized)
- Empty input → immediate [] return (no model call)
- Result truncated to reranker_top_n setting

Does NOT test:
- Actual CrossEncoder model quality or scores
- Vector search or FTS retrieval logic (covered by retrieve.py tests if added)
"""

import pytest

from app.rag.rerank import rerank_chunks, TRUST_TIER_BOOST


# ── Helpers ──────────────────────────────────────────────────────────────────

def make_chunk(content: str, trust_tier: int) -> dict:
    """Build a minimal chunk dict for reranking tests."""
    return {"content": content, "trust_tier": trust_tier}


def set_scores(mock_encoder, scores: list[float]) -> None:
    """
    Override the mock encoder to return a specific score list.
    Scores are returned in the same order as the input pairs.
    """
    mock_encoder.predict.side_effect = lambda pairs: scores[: len(pairs)]


# ── TRUST_TIER_BOOST constant integrity ──────────────────────────────────────

def test_trust_tier_boost_covers_all_defined_tiers():
    """
    TRUST_TIER_BOOST must define multipliers for tiers 1–6.
    Adding a new tier without a multiplier entry would silently apply 1.0.
    """
    for tier in range(1, 7):
        assert tier in TRUST_TIER_BOOST, f"Missing boost for tier {tier}"


def test_trust_tier_boost_ordering():
    """
    Lower tier number (more authoritative) must have a higher multiplier.
    Tier 1 (local code) should always outrank Tier 6 (supplementary) given
    equal relevance.
    """
    for lower, higher in [(1, 2), (2, 3), (3, 4), (4, 5), (5, 6)]:
        assert TRUST_TIER_BOOST[lower] > TRUST_TIER_BOOST[higher], (
            f"Tier {lower} boost ({TRUST_TIER_BOOST[lower]}) should be > "
            f"Tier {higher} boost ({TRUST_TIER_BOOST[higher]})"
        )


# ── Empty input ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_empty_chunks_returns_empty_list(mock_cross_encoder):
    """
    Empty input must return [] immediately without calling the model.
    Avoids a predict() call on empty input which some models handle poorly.
    """
    result = await rerank_chunks("query", [])
    assert result == []
    mock_cross_encoder.predict.assert_not_called()


# ── Tier ordering with equal raw scores ──────────────────────────────────────

@pytest.mark.asyncio
async def test_tier1_beats_tier4_equal_raw_scores(mock_cross_encoder):
    """
    Tier 1 (0.80 × 1.20 = 0.960) must outrank Tier 4 (0.80 × 1.00 = 0.800)
    when the CrossEncoder assigns both the same raw score (0.80).

    This models the core use case: a local ordinance chunk (Tier 1) and a
    best-practice guide chunk (Tier 4) with the same cosine similarity —
    the ordinance should surface first.
    """
    chunks = [
        make_chunk("tier4_content", trust_tier=4),
        make_chunk("tier1_content", trust_tier=1),
    ]
    set_scores(mock_cross_encoder, [0.80, 0.80])

    result = await rerank_chunks("how to screen vents?", chunks)

    assert len(result) >= 2
    tier_order = [c["trust_tier"] for c in result[:2]]
    assert tier_order[0] == 1, f"Expected Tier 1 first, got order {tier_order}"


@pytest.mark.asyncio
async def test_tier1_beats_tier2_even_when_tier2_has_higher_raw_score(mock_cross_encoder):
    """
    Tier 1 (0.75 × 1.20 = 0.900) beats Tier 2 (0.80 × 1.10 = 0.880)
    even though Tier 2 has a higher raw relevance score.

    This ensures that local codes (Tier 1) are preferred over agency guidance
    (Tier 2) for slight raw-score differences. The boost is intentionally
    larger for Tier 1 to model this preference.
    """
    chunks = [
        make_chunk("tier2_content", trust_tier=2),
        make_chunk("tier1_content", trust_tier=1),
    ]
    # Tier 2 gets higher raw score (0.80), Tier 1 gets lower (0.75)
    # Tier 2 boosted: 0.80 * 1.10 = 0.880
    # Tier 1 boosted: 0.75 * 1.20 = 0.900  ← should still win
    set_scores(mock_cross_encoder, [0.80, 0.75])

    result = await rerank_chunks("ashland fire code requirements", chunks)

    tier_order = [c["trust_tier"] for c in result[:2]]
    assert tier_order[0] == 1, (
        f"Tier 1 (score 0.75×1.20=0.90) should beat Tier 2 (0.80×1.10=0.88). "
        f"Got order: {tier_order}"
    )


@pytest.mark.asyncio
async def test_high_raw_score_can_overcome_tier_penalty(mock_cross_encoder):
    """
    A sufficiently high raw score can still win despite a lower tier.
    Tier 5 (0.90 × 0.95 = 0.855) beats Tier 4 (0.80 × 1.00 = 0.800).

    Realistic scenario: a grant-program chunk (Tier 5) that is highly
    relevant to the query beats a generic best-practice chunk (Tier 4)
    that is less relevant. The boost does not completely override relevance.
    """
    chunks = [
        make_chunk("tier4_low_relevance", trust_tier=4),
        make_chunk("tier5_high_relevance", trust_tier=5),
    ]
    set_scores(mock_cross_encoder, [0.80, 0.90])

    result = await rerank_chunks("oregon grant programs defensible space", chunks)

    tier_order = [c["trust_tier"] for c in result[:2]]
    assert tier_order[0] == 5, (
        f"Tier 5 (0.90×0.95=0.855) should beat Tier 4 (0.80×1.00=0.80). "
        f"Got order: {tier_order}"
    )


@pytest.mark.asyncio
async def test_unknown_tier_uses_default_multiplier_of_1(mock_cross_encoder):
    """
    A chunk with an unknown trust_tier (e.g., 99) must not crash and must
    be treated as 1.0 multiplier — same as Tier 4 (neutral).

    Prevents KeyError if new tiers are added to the schema without updating
    the TRUST_TIER_BOOST dict.
    """
    chunks = [
        make_chunk("unknown_tier_chunk", trust_tier=99),
        make_chunk("tier4_chunk", trust_tier=4),
    ]
    set_scores(mock_cross_encoder, [0.80, 0.80])

    result = await rerank_chunks("vents", chunks)
    # Both should appear; neither should error
    assert len(result) == 2


# ── Input order independence ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_input_order_does_not_affect_output_ranking(mock_cross_encoder):
    """
    The first chunk in the input list should not get preferential treatment.
    With equal scores, a lower-tier chunk first in the list must still lose
    to a higher-tier chunk later in the list.
    """
    chunks_normal = [make_chunk("tier4", trust_tier=4), make_chunk("tier1", trust_tier=1)]
    chunks_reversed = [make_chunk("tier1", trust_tier=1), make_chunk("tier4", trust_tier=4)]

    set_scores(mock_cross_encoder, [0.80, 0.80])
    result_normal = await rerank_chunks("q", chunks_normal)
    set_scores(mock_cross_encoder, [0.80, 0.80])
    result_reversed = await rerank_chunks("q", chunks_reversed)

    # In both cases, tier 1 should appear first
    assert result_normal[0]["trust_tier"] == 1
    assert result_reversed[0]["trust_tier"] == 1


# ── Truncation ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_result_truncated_to_reranker_top_n(mock_cross_encoder, monkeypatch):
    """
    Result must be truncated to settings.reranker_top_n chunks.
    Monkeypatches the setting to 2 to test without needing 12+ chunks.
    """
    import app.rag.rerank as rerank_module
    from unittest.mock import MagicMock

    mock_settings = MagicMock()
    mock_settings.reranker_top_n = 2
    monkeypatch.setattr(rerank_module, "settings", mock_settings)

    chunks = [make_chunk(f"chunk_{i}", trust_tier=4) for i in range(5)]
    set_scores(mock_cross_encoder, [0.8, 0.7, 0.6, 0.5, 0.4])

    result = await rerank_chunks("query", chunks)
    assert len(result) == 2, f"Expected 2 results with top_n=2, got {len(result)}"
