"""BGE reranker for chunk relevance scoring with trust tier boosting."""

from app.config import get_settings

settings = get_settings()

_reranker = None


def get_reranker():
    """Get or create reranker model instance."""
    global _reranker
    if _reranker is None:
        from sentence_transformers import CrossEncoder

        _reranker = CrossEncoder(settings.reranker_model, device=settings.reranker_device)
    return _reranker


# Higher-trust sources get a score boost so they surface above lower-trust chunks
# when relevance scores are similar.
TRUST_TIER_BOOST: dict[int, float] = {
    1: 1.20,   # Local code / ordinances
    2: 1.10,   # Agency guidance (NFPA, IBHS, ODF)
    3: 1.05,   # Fire science evidence (peer-reviewed studies)
    4: 1.00,   # Best-practice guides
    5: 0.95,   # Grant / program info
    6: 0.90,   # Supplementary / older docs
}


async def rerank_chunks(query: str, chunks: list[dict]) -> list[dict]:
    """Rerank chunks by relevance with trust-tier boost.

    Higher-trust sources (local code = Tier 1) surface above equivalent-relevance
    lower-trust sources.
    """
    if not chunks:
        return []

    reranker = get_reranker()

    pairs = [(query, chunk["content"]) for chunk in chunks]
    scores = reranker.predict(pairs)

    boosted_scores = []
    for score, chunk in zip(scores, chunks):
        tier = chunk.get("trust_tier", 4)
        boost = TRUST_TIER_BOOST.get(tier, 1.0)
        boosted_scores.append(score * boost)

    scored_chunks = sorted(zip(boosted_scores, chunks), key=lambda x: x[0], reverse=True)
    return [chunk for _, chunk in scored_chunks[: settings.reranker_top_n]]
