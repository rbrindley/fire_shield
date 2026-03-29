"""Hybrid retrieval: FTS5 + vector search with jurisdiction chain filtering."""

import logging

from app.config.database import get_db
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def _sanitize_fts_query(query: str) -> str:
    """Sanitize query for FTS5 to prevent syntax errors."""
    STOPWORDS = {
        'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
        'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
        'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
        'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
        'below', 'between', 'under', 'again', 'further', 'then', 'once',
        'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few',
        'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
        'own', 'same', 'so', 'than', 'too', 'very', 'just', 'what', 'which',
        'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'it', 'its',
        'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you',
        'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'she',
        'her', 'hers', 'they', 'them', 'their', 'theirs'
    }

    sanitized_terms = []
    for term in query.split():
        if term.upper() in ('AND', 'OR', 'NOT', 'NEAR'):
            continue
        clean_term = term.replace('"', '').strip()
        if not clean_term or clean_term.lower() in STOPWORDS:
            continue
        sanitized_terms.append(f'"{clean_term}"')

    if not sanitized_terms:
        return '""'
    return ' OR '.join(sanitized_terms)


async def retrieve_chunks(
    query: str,
    jurisdiction_chain: list[str],
) -> list[dict]:
    """Retrieve chunks using hybrid search (FTS5 + vector), filtered by jurisdiction chain."""
    fts_results = await _fts_search(query, jurisdiction_chain)
    try:
        vector_results = await _vector_search(query, jurisdiction_chain)
    except Exception as e:
        logger.warning(f"Vector search failed (falling back to FTS only): {e}")
        vector_results = []

    seen_ids = set()
    merged = []
    for chunk in fts_results + vector_results:
        if chunk["id"] not in seen_ids:
            seen_ids.add(chunk["id"])
            merged.append(chunk)

    diversified = _diversify_results(merged)
    return diversified[:50]


async def _fts_search(query: str, jurisdiction_chain: list[str]) -> list[dict]:
    """Full-text search using SQLite FTS5 with jurisdiction chain filter."""
    async with get_db() as db:
        sanitized = _sanitize_fts_query(query)
        if not sanitized or sanitized == '""':
            return []

        placeholders = ",".join("?" * len(jurisdiction_chain))
        cursor = await db.execute(
            f"""
            SELECT c.id, dv.document_id, c.chunk_index, c.content,
                   c.section_title, c.jurisdiction, c.trust_tier,
                   d.title as doc_title, d.source_url,
                   bm25(chunks_fts) as score
            FROM chunks_fts fts
            JOIN chunks c ON fts.chunk_id = c.id
            JOIN document_versions dv ON c.doc_version_id = dv.id
            JOIN documents d ON dv.document_id = d.id
            WHERE chunks_fts MATCH ?
              AND c.jurisdiction IN ({placeholders})
              AND d.status = 'active'
            ORDER BY score
            LIMIT ?
            """,
            (sanitized, *jurisdiction_chain, settings.fts_top_k),
        )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


async def _vector_search(query: str, jurisdiction_chain: list[str]) -> list[dict]:
    """Vector similarity search using Qdrant with jurisdiction chain filter."""
    from qdrant_client import QdrantClient
    from qdrant_client.models import Filter, FieldCondition, MatchAny
    from app.rag.embedder import get_embedder

    embedder = get_embedder()
    query_embedding = await embedder.embed([query])

    client = QdrantClient(host=settings.qdrant_host, port=settings.qdrant_port)

    qdrant_filter = Filter(
        must=[
            FieldCondition(
                key="jurisdiction",
                match=MatchAny(any=jurisdiction_chain),
            )
        ]
    )

    if hasattr(client, "query_points"):
        response = client.query_points(
            collection_name=settings.qdrant_collection,
            query=query_embedding[0],
            query_filter=qdrant_filter,
            limit=settings.vector_top_k,
            with_payload=True,
        )
        results = getattr(response, "points", [])
    elif hasattr(client, "search"):
        results = client.search(
            collection_name=settings.qdrant_collection,
            query_vector=query_embedding[0],
            query_filter=qdrant_filter,
            limit=settings.vector_top_k,
        )
    else:
        raise RuntimeError("Unsupported qdrant-client API")

    chunk_ids = [hit.payload.get("chunk_id") for hit in results if getattr(hit, "payload", None)]
    if not chunk_ids:
        return []

    async with get_db() as db:
        placeholders = ",".join("?" * len(chunk_ids))
        cursor = await db.execute(
            f"""
            SELECT c.id, dv.document_id, c.chunk_index, c.content,
                   c.section_title, c.jurisdiction, c.trust_tier,
                   d.title as doc_title, d.source_url
            FROM chunks c
            JOIN document_versions dv ON c.doc_version_id = dv.id
            JOIN documents d ON dv.document_id = d.id
            WHERE c.id IN ({placeholders})
              AND d.status = 'active'
            """,
            chunk_ids,
        )
        rows = await cursor.fetchall()
        chunk_dict = {dict(row)["id"]: dict(row) for row in rows}
        return [chunk_dict[cid] for cid in chunk_ids if cid in chunk_dict]


def _diversify_results(chunks: list[dict], max_per_section: int = 4) -> list[dict]:
    """Diversify results to avoid over-representation from a single section."""
    from collections import defaultdict

    section_counts = defaultdict(int)
    diversified = []
    for chunk in chunks:
        key = (chunk.get("document_id"), chunk.get("section_title", ""))
        if section_counts[key] < max_per_section:
            diversified.append(chunk)
            section_counts[key] += 1

    return diversified
