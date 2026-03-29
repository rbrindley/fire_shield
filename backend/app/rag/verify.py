"""Citation verification and faithfulness checking."""

import logging
import re

from app.models.query import Citation
from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


async def verify_response(
    answer: str,
    citations: list[Citation],
    chunks: list[dict],
) -> tuple[str, list[Citation], int]:
    """Verify citations in response and check faithfulness."""
    from app.rag.embedder import get_embedder
    import torch
    from sentence_transformers import util

    embedder = get_embedder()
    chunk_map = {c["id"]: c for c in chunks}

    # With [1], [2] style citations, invalid citations are those
    # where the number doesn't map to a source in our citation list
    # This is handled during extraction, so we just verify faithfulness here

    verified_answer = answer
    verified_citations = []
    unknown_count = 0

    for citation in citations:
        if citation.chunk_id in chunk_map:
            chunk = chunk_map[citation.chunk_id]

            # Check semantic similarity
            faithfulness_score = await _check_faithfulness(
                citation.excerpt, chunk["content"], embedder
            )

            citation.faithfulness_score = faithfulness_score
            citation.is_low_faithfulness = faithfulness_score < settings.faithfulness_threshold

            if citation.is_low_faithfulness:
                unknown_count += 1

            verified_citations.append(citation)

    return verified_answer, verified_citations, unknown_count


async def _check_faithfulness(
    claim_text: str,
    source_text: str,
    embedder,
) -> float:
    """Check semantic similarity between claim and source."""
    import torch
    from sentence_transformers import util

    embeddings = await embedder.embed([claim_text, source_text])
    claim_emb = torch.tensor(embeddings[0])
    source_emb = torch.tensor(embeddings[1])

    similarity = util.cos_sim(claim_emb, source_emb).item()
    return similarity
