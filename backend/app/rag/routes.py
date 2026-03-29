"""RAG query routes."""

import asyncio
import time

from fastapi import APIRouter, HTTPException, status

from app.config import get_settings
from app.models.query import QueryRequest, QueryResponse, ResourceLink

router = APIRouter()
settings = get_settings()

_DEFAULT_RESOURCES: dict[str, list[dict]] = {
    "plants": [
        {"title": "Browse plant database", "description": "Search fire-resistant plants by zone and traits", "intent_tag": "plants"},
        {"title": "Zone planting guide", "description": "Which plants belong in each defensible space zone", "intent_tag": "zones"},
    ],
    "map": [
        {"title": "View your property map", "description": "See your defensible space zones on the map", "intent_tag": "map"},
        {"title": "Zone actions checklist", "description": "Actions to complete for each zone layer", "intent_tag": "zones"},
    ],
    "zones": [
        {"title": "Defensible space zones", "description": "Understand the 0-5ft, 5-30ft, 30-100ft, and 100+ft zones", "intent_tag": "zones"},
        {"title": "Zone actions by layer", "description": "Prioritized actions for each zone layer", "intent_tag": "zones"},
    ],
    "build": [
        {"title": "Build instructions", "description": "Step-by-step guides for fire preparedness projects", "intent_tag": "build"},
        {"title": "Educational prompts", "description": "Teaching resources and classroom activities", "intent_tag": "build"},
    ],
    "general": [
        {"title": "Ask the Digital Arborist", "description": "Get personalized wildfire preparedness advice", "intent_tag": "general"},
    ],
    "property": [
        {"title": "View your property map", "description": "See your defensible space zones on the map", "intent_tag": "map"},
        {"title": "Property assessment", "description": "Review your property's readiness score", "intent_tag": "property"},
    ],
}


def _merge_resource_links(
    llm_links: list[ResourceLink], intent: str, max_total: int = 10,
) -> list[ResourceLink]:
    """Merge LLM-generated links with hardcoded defaults, up to max_total."""
    result = list(llm_links)
    seen_titles = {link.title.lower() for link in result}

    for default in _DEFAULT_RESOURCES.get(intent, []):
        if len(result) >= max_total:
            break
        if default["title"].lower() not in seen_titles:
            result.append(ResourceLink(**default))
            seen_titles.add(default["title"].lower())

    return result[:max_total]


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
    answer, citations, jurisdiction_note, nws_alert, intent, resource_links = await generate_answer(
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

    # Merge LLM resource suggestions with hardcoded defaults
    intent_name = intent.primary_intent if intent else "general"
    merged_links = _merge_resource_links(resource_links, intent_name)

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
        intent=intent,
        resource_links=merged_links,
        profile_used=request.profile,
        retrieval_time_ms=retrieval_time_ms,
        generation_time_ms=generation_time_ms,
        total_time_ms=total_time_ms,
    )
