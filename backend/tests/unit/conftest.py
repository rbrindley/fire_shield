"""
Unit-test level fixtures.

Provides a mock CrossEncoder (autouse=False by default) so that tests
in test_rerank.py can import it without triggering sentence-transformers
model downloads. Apply via @pytest.mark.usefixtures or explicit parameter.
"""

from unittest.mock import MagicMock, patch
import pytest


@pytest.fixture
def mock_cross_encoder():
    """
    Replace the CrossEncoder used by rerank.py with a MagicMock.

    The mock's predict() returns a constant score of 0.8 for every pair,
    so raw scores are identical across all chunks. Ranking then depends
    entirely on the TRUST_TIER_BOOST multiplier, making tier-ordering
    assertions deterministic.

    Individual tests can override predict() via mock_cross_encoder.predict
    to inject controlled per-chunk scores.

    Does NOT mock settings.reranker_top_n — monkeypatch that in the test
    if you need to verify truncation.
    """
    with patch("app.rag.rerank.get_reranker") as mock_get:
        encoder = MagicMock()
        encoder.predict.side_effect = lambda pairs: [0.8] * len(pairs)
        mock_get.return_value = encoder
        yield encoder
