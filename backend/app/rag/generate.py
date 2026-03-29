"""Answer generation using Claude with NWS tool-use."""

import json
import re
from typing import Literal

from app.config import get_settings
from app.models.query import Citation
from app.rag.profiles import get_profile_instructions

settings = get_settings()


WILDFIRE_SYSTEM_PROMPT = """You are a wildfire preparedness advisor for Southern Oregon's Rogue Valley.
Answer questions using ONLY the provided source chunks. Be specific to the user's jurisdiction.

JURISDICTION CONTEXT:
{jurisdiction_context}

CITATION FORMAT:
- Cite sources by their reference number: [1], [2], [3], etc.
- Place citation immediately after the relevant information
- Example: "Clear vegetation within 5 feet of your home [1]."
- If a topic is not covered in sources, say so clearly

TRUST HIERARCHY: Local code (Tier 1) > Agency guidance (Tier 2) > Fire science evidence (Tier 3+)
Source headers show [TIER-n-TYPE] — higher-trust sources take precedence when they conflict.

{profile_instructions}
{memory_section}
SOURCES:
{chunks_text}
"""


async def generate_answer(
    question: str,
    chunks: list[dict],
    jurisdiction_code: str,
    jurisdiction_display: str,
    jurisdiction_chain: list[str],
    profile: str,
    lat: float | None = None,
    lng: float | None = None,
    memory_context: str | None = None,
) -> tuple[str, list[Citation], str | None, str | None]:
    """Generate answer using Claude with jurisdiction context and NWS tool-use.

    Returns:
        (renumbered_answer, citations, jurisdiction_note, nws_alert)
    """
    chunks_text, number_to_id = _format_chunks_for_context(chunks)
    profile_instructions = get_profile_instructions(profile)

    # Build jurisdiction transparency context
    has_city_docs = any(
        c.get("jurisdiction") == jurisdiction_code for c in chunks
        if jurisdiction_code not in ("jackson_county", "universal", "federal", "oregon_state")
    )
    city_names = {
        "ashland": "Ashland", "jacksonville": "Jacksonville", "medford": "Medford",
        "talent": "Talent", "phoenix": "Phoenix", "central_point": "Central Point",
        "eagle_point": "Eagle Point",
    }
    city_display = city_names.get(jurisdiction_code, "")

    if city_display and not has_city_docs:
        jurisdiction_note = (
            f"{city_display}-specific documents are not yet in the corpus. "
            f"Showing Jackson County, Oregon state, and universal guidance — "
            f"which covers most requirements. Check with your local fire department "
            f"for {city_display}-specific ordinances."
        )
    else:
        jurisdiction_note = None

    jurisdiction_context = (
        f"The user's property is in **{jurisdiction_display}**. "
        f"Jurisdiction chain: {' → '.join(jurisdiction_chain)}. "
        f"Reference {city_display or jurisdiction_display} requirements by name when available. "
        f"If city-specific docs are not in the corpus, note this and apply county + state + universal guidance."
    )

    memory_section = ""
    if memory_context:
        memory_section = (
            "\nPROPERTY MEMORY (facts remembered from previous conversations):\n"
            + memory_context
            + "\n"
        )

    system_prompt = WILDFIRE_SYSTEM_PROMPT.format(
        jurisdiction_context=jurisdiction_context,
        profile_instructions=profile_instructions,
        chunks_text=chunks_text,
        memory_section=memory_section,
    )

    # NWS tool-use: fetch live fire weather if lat/lng provided
    nws_alert = None
    if lat is not None and lng is not None:
        nws_alert = await _fetch_nws_alert(lat, lng)

    answer = await _generate_claude(system_prompt, question, nws_alert)
    renumbered_answer, citations = _extract_citations_and_renumber(answer, chunks, number_to_id)

    return renumbered_answer, citations, jurisdiction_note, nws_alert


def _format_chunks_for_context(chunks: list[dict]) -> tuple[str, dict[int, str]]:
    """Format chunks with [1], [2] numbering and tier/type labels."""
    formatted = []
    number_to_id = {}

    for i, chunk in enumerate(chunks, 1):
        number_to_id[i] = chunk["id"]

        tier = chunk.get("trust_tier", 4)
        jurisdiction = chunk.get("jurisdiction", "universal").upper()

        # Map tier to type label
        if tier == 1:
            tier_label = "TIER-1-LOCAL-CODE"
        elif tier == 2:
            tier_label = "TIER-2-AGENCY-GUIDANCE"
        elif tier == 3:
            tier_label = "TIER-3-FIRE-EVIDENCE"
        elif tier == 4:
            tier_label = "TIER-4-BEST-PRACTICE"
        else:
            tier_label = f"TIER-{tier}"

        section = chunk.get("section_title", "")
        doc_title = chunk.get("doc_title", "Unknown")

        header_parts = [f"[{i}]", f"[{tier_label}]", f"[{jurisdiction}]", doc_title]
        if section:
            header_parts.append(section)

        chunk_header = " — ".join(header_parts)
        formatted.append(f"{chunk_header}\n{chunk['content']}\n")

    return "\n---\n".join(formatted), number_to_id


async def _fetch_nws_alert(lat: float, lng: float) -> str | None:
    """Fetch active NWS fire weather alerts for a location."""
    import httpx

    headers = {
        "User-Agent": settings.nws_user_agent,
        "Accept": "application/geo+json",
    }
    url = f"https://api.weather.gov/alerts/active?point={lat},{lng}"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                return None
            data = resp.json()
            features = data.get("features", [])
            fire_alerts = [
                f for f in features
                if any(
                    kw in f.get("properties", {}).get("event", "").lower()
                    for kw in ("fire", "red flag", "wind")
                )
            ]
            if fire_alerts:
                alert = fire_alerts[0]["properties"]
                return f"{alert.get('event', 'Fire Weather Alert')}: {alert.get('headline', '')}"
    except Exception:
        pass
    return None


async def _generate_claude(
    system_prompt: str,
    question: str,
    nws_alert: str | None = None,
) -> str:
    """Generate using Claude API."""
    from anthropic import AsyncAnthropic

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    user_content = question
    if nws_alert:
        user_content = f"[Active NWS Alert: {nws_alert}]\n\n{question}"

    response = await client.messages.create(
        model=settings.claude_model,
        max_tokens=4096,
        system=system_prompt,
        messages=[{"role": "user", "content": user_content}],
    )

    return response.content[0].text


def _extract_citations_and_renumber(
    answer: str, chunks: list[dict], number_to_id: dict[int, str]
) -> tuple[str, list[Citation]]:
    """Extract citations, renumber sequentially, attach metadata."""
    chunk_map = {c["id"]: c for c in chunks}

    citation_pattern = r"\[(\d+)\]"
    found_numbers = []
    for match in re.finditer(citation_pattern, answer):
        num = int(match.group(1))
        if num not in found_numbers and num in number_to_id:
            found_numbers.append(num)

    source_to_footnote = {src_num: i + 1 for i, src_num in enumerate(found_numbers)}

    def replace_citation(match):
        src_num = int(match.group(1))
        if src_num in source_to_footnote:
            return f"[{source_to_footnote[src_num]}]"
        return match.group(0)

    renumbered_answer = re.sub(citation_pattern, replace_citation, answer)

    citations = []
    for src_num in found_numbers:
        chunk_id = number_to_id.get(src_num)
        if chunk_id and chunk_id in chunk_map:
            chunk = chunk_map[chunk_id]
            tier = chunk.get("trust_tier", 4)
            # Map tier to citation_type
            if tier <= 2:
                citation_type = "retrieved_document"
            elif tier == 3:
                citation_type = "fire_science_evidence"
            else:
                citation_type = "retrieved_document"

            # Structured data gets its own type (zone actions, plants)
            if chunk.get("doc_type") == "structured_data":
                citation_type = "structured_data"

            citations.append(
                Citation(
                    chunk_id=chunk_id,
                    ref_number=source_to_footnote[src_num],
                    source_number=src_num,
                    document_title=chunk.get("doc_title", "Unknown"),
                    section_title=chunk.get("section_title"),
                    excerpt=(
                        chunk["content"][:300] + "..."
                        if len(chunk["content"]) > 300
                        else chunk["content"]
                    ),
                    citation_type=citation_type,
                    trust_tier=tier,
                    source_url=chunk.get("source_url"),
                )
            )

    return renumbered_answer, citations
