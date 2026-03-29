"""RAG query routes."""

import asyncio
import time

from fastapi import APIRouter, HTTPException, status

from app.config import get_settings
from app.models.query import QueryRequest, QueryResponse

router = APIRouter()
settings = get_settings()


@router.post("/", response_model=QueryResponse)
async def query(request: QueryRequest):
    """Execute a wildfire RAG query with jurisdiction-aware retrieval."""
    from app.rag.retrieve import retrieve_chunks
    from app.rag.rerank import rerank_chunks
    from app.rag.generate import generate_answer
    from app.rag.smart_filter import build_jurisdiction_chain

    start_time = time.time()

    if not settings.anthropic_api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Claude API is not configured. Set ANTHROPIC_API_KEY.",
        )

    # Resolve jurisdiction chain
    jurisdiction_chain = build_jurisdiction_chain(request.jurisdiction_code)

    # Build display name for prompt
    jurisdiction_display_map = {
        "ashland": "Ashland, Jackson County, OR",
        "jacksonville": "Jacksonville, Jackson County, OR",
        "medford": "Medford, Jackson County, OR",
        "talent": "Talent, Jackson County, OR",
        "phoenix": "Phoenix, Jackson County, OR",
        "central_point": "Central Point, Jackson County, OR",
        "eagle_point": "Eagle Point, Jackson County, OR",
        "jackson_county": "Jackson County, OR",
        "josephine_county": "Josephine County, OR",
        "grants_pass": "Grants Pass, Josephine County, OR",
        "oregon_state": "Oregon",
    }
    jurisdiction_display = jurisdiction_display_map.get(
        request.jurisdiction_code, request.jurisdiction_code.replace("_", " ").title()
    )

    # Retrieval
    retrieval_start = time.time()
    chunks = await retrieve_chunks(request.question, jurisdiction_chain)
    retrieval_time_ms = int((time.time() - retrieval_start) * 1000)

    if not chunks:
        return QueryResponse(
            answer="No relevant guidance found for your question. Try rephrasing, or ask your local fire department.",
            citations=[],
            profile_used=request.profile,
            retrieval_time_ms=retrieval_time_ms,
            generation_time_ms=0,
            total_time_ms=int((time.time() - start_time) * 1000),
        )

    # Reranking
    reranked_chunks = await rerank_chunks(request.question, chunks)

    # Load conversation memory if property profile provided
    memory_context = None
    if request.property_profile_id:
        try:
            from app.memory.service import format_memory_context
            memory_context = await format_memory_context(request.property_profile_id)
        except Exception:
            pass  # Memory is non-critical

    # Generation
    generation_start = time.time()
    answer, citations, jurisdiction_note, nws_alert = await generate_answer(
        question=request.question,
        chunks=reranked_chunks,
        jurisdiction_code=request.jurisdiction_code,
        jurisdiction_display=jurisdiction_display,
        jurisdiction_chain=jurisdiction_chain,
        profile=request.profile,
        lat=request.lat,
        lng=request.lng,
        memory_context=memory_context,
    )
    generation_time_ms = int((time.time() - generation_start) * 1000)
    total_time_ms = int((time.time() - start_time) * 1000)

    # Fire memory extraction as background task (non-blocking)
    if request.property_profile_id and settings.anthropic_api_key:
        try:
            from app.memory.extractor import extract_memories
            asyncio.create_task(
                extract_memories(request.question, answer, request.property_profile_id)
            )
        except Exception:
            pass  # Memory extraction is non-critical

    return QueryResponse(
        answer=answer,
        citations=citations,
        jurisdiction_note=jurisdiction_note,
        nws_alert=nws_alert,
        profile_used=request.profile,
        retrieval_time_ms=retrieval_time_ms,
        generation_time_ms=generation_time_ms,
        total_time_ms=total_time_ms,
    )
