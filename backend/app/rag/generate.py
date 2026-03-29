"""Answer generation using Claude with NWS tool-use."""

import json
import re
from typing import Literal

from app.config import get_settings
from app.models.query import Citation, IntentClassification, ResourceLink, TabContext
from app.rag.profiles import get_profile_instructions

settings = get_settings()


WILDFIRE_SYSTEM_PROMPT = """You are a wildfire preparedness advisor for Southern Oregon's Rogue Valley.
{source_constraint}
Be specific to the user's jurisdiction.

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

INTENT CLASSIFICATION:
After your answer, on a new line emit exactly one JSON block fenced like this:
<!-- INTENT_JSON: {{"intent": "...", "confidence": 0.0, "resource_suggestions": [...], "address_mentioned": null, "tab_context": null}} -->
- intent: one of "map", "plants", "zones", "build", "property", "general"
  - "map" = user wants to see their property map, zone rings, or satellite view
  - "plants" = user asks about fire-resistant plants, landscaping, vegetation
  - "zones" = user asks about defensible space zones, zone actions, clearance distances
  - "build" = user asks about education, teaching, building projects, DIY instructions
  - "property" = user asks about their specific property assessment or profile
  - "general" = everything else (grants, insurance, general preparedness)
- confidence: 0.0 to 1.0
- resource_suggestions: array of 2-4 objects with "title", "description", "intent_tag" fields. These are contextual next-step links shown to the user. Tailor them to the specific question — e.g. if the user asks about roof vents, suggest "Vent screening guide" (zones) and "Fire-resistant roofing plants" (plants), NOT generic links. Each object needs: "title" (short action label), "description" (1 sentence why it's relevant to THIS question), "intent_tag" (one of: map, plants, zones, build, general). Only suggest what's genuinely useful as a follow-up.
- address_mentioned: If the user mentions a street address, city+state, or coordinates in their message, extract it verbatim as a string. Otherwise null. Examples: "123 Oak St, Ashland OR", "42.1945, -122.7095". Do NOT fabricate addresses.
- tab_context: If intent is "plants", extract the plant name/type as "search_query" and the zone as "zone_filter" (one of: zone_0_5ft, zone_5_30ft, zone_30_100ft, zone_100ft_plus) based on distance mentioned. If intent is "zones", extract the zone layer as "zone_filter". Otherwise null. Examples: {{"search_query": "aloe", "zone_filter": "zone_0_5ft"}}, {{"search_query": "oak trees", "zone_filter": "zone_30_100ft"}}. "next to my house" / "near the house" / "by the structure" = zone_0_5ft. "yard" / "garden" = zone_5_30ft.
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
) -> tuple[str, list[Citation], str | None, str | None, IntentClassification | None, list[ResourceLink], str | None]:
    """Generate answer using Claude with jurisdiction context and NWS tool-use.

    Returns:
        (renumbered_answer, citations, jurisdiction_note, nws_alert, intent, resource_links, address_mentioned)
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

    source_constraint = (
        "For wildfire-specific questions, answer using the provided source chunks and cite them. "
        "For questions about teaching, AI agents, coding, or the Fire Shield app itself, use your general knowledge and the app context in your instructions."
        if profile == "teacher"
        else "Answer questions using ONLY the provided source chunks."
    )

    system_prompt = WILDFIRE_SYSTEM_PROMPT.format(
        source_constraint=source_constraint,
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
    cleaned_answer, intent, resource_links, address_mentioned = _extract_intent_and_resources(answer)
    renumbered_answer, citations = _extract_citations_and_renumber(cleaned_answer, chunks, number_to_id)

    return renumbered_answer, citations, jurisdiction_note, nws_alert, intent, resource_links, address_mentioned


_INTENT_PATTERN = re.compile(r"<!--\s*INTENT_JSON:\s*(\{.*?\})\s*-->", re.DOTALL)

_VALID_INTENTS = {"map", "plants", "zones", "build", "property", "general"}


def _extract_intent_and_resources(
    answer: str,
) -> tuple[str, IntentClassification | None, list[ResourceLink], str | None]:
    """Parse the <!-- INTENT_JSON: ... --> block from the LLM answer.

    Returns (cleaned_answer, intent, resource_links, address_mentioned). Falls back gracefully.
    """
    match = _INTENT_PATTERN.search(answer)
    if not match:
        return answer, None, [], None

    cleaned = answer[: match.start()].rstrip() + answer[match.end() :]
    cleaned = cleaned.rstrip()

    try:
        data = json.loads(match.group(1))
        intent_str = data.get("intent", "general")
        if intent_str not in _VALID_INTENTS:
            intent_str = "general"

        tab_context = None
        tc_data = data.get("tab_context")
        if isinstance(tc_data, dict):
            tab_context = TabContext(
                search_query=tc_data.get("search_query"),
                zone_filter=tc_data.get("zone_filter"),
            )

        intent = IntentClassification(
            primary_intent=intent_str,
            confidence=float(data.get("confidence", 0.5)),
            resource_tab=intent_str,
            tab_context=tab_context,
        )

        resource_links = []
        for sug in data.get("resource_suggestions", []):
            if isinstance(sug, dict) and "title" in sug:
                resource_links.append(
                    ResourceLink(
                        title=sug["title"],
                        description=sug.get("description", ""),
                        intent_tag=sug.get("intent_tag", intent_str),
                        url=sug.get("url"),
                    )
                )

        address_mentioned = data.get("address_mentioned") or None

        return cleaned, intent, resource_links, address_mentioned
    except (json.JSONDecodeError, ValueError, TypeError):
        return cleaned, None, [], None


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


PLANT_SEARCH_TOOL = {
    "name": "search_plants",
    "description": (
        "Search Fire Shield's fire-resistant plant database. Use this when the user asks about "
        "specific plants, plant recommendations, landscaping, what to plant in a zone, "
        "pollinators, native plants, or whether a specific plant is suitable. "
        "Returns plants with zone eligibility, fire behavior notes, and traits."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Plant name or keyword search (e.g. 'aloe', 'lavender', 'oak')",
            },
            "zone": {
                "type": "string",
                "enum": ["zone_0_5ft", "zone_5_30ft", "zone_30_100ft", "zone_100ft_plus"],
                "description": "Filter to plants eligible for this HIZ zone",
            },
            "native": {
                "type": "boolean",
                "description": "Filter to Oregon native plants only",
            },
            "deer_resistant": {
                "type": "boolean",
                "description": "Filter to deer-resistant plants only",
            },
            "pollinator_support": {
                "type": "boolean",
                "description": "Filter to plants that support pollinators",
            },
            "sun": {
                "type": "string",
                "enum": ["full", "partial", "shade"],
                "description": "Filter by sun requirement",
            },
            "water_need": {
                "type": "string",
                "enum": ["low", "medium", "high"],
                "description": "Filter by water need",
            },
            "limit": {
                "type": "integer",
                "description": "Max results to return (default 10)",
            },
        },
        "required": [],
    },
}


NURSERY_LOOKUP_TOOL = {
    "name": "nursery_lookup",
    "description": (
        "Search Nature Hills Nursery for a plant to check price and availability. "
        "Use this when the user asks about buying, ordering, or pricing a plant. "
        "Returns product names, prices, direct links, and add-to-cart URLs. "
        "Extract the quantity from the user's message (default 1)."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "plant_name": {
                "type": "string",
                "description": "Common name of the plant (e.g. 'aloe', 'lavender', 'ceanothus')",
            },
            "scientific_name": {
                "type": "string",
                "description": "Optional scientific name for more precise results",
            },
            "quantity": {
                "type": "integer",
                "description": "Number of plants the user wants to order (default 1)",
                "default": 1,
            },
        },
        "required": ["plant_name"],
    },
}


async def _execute_nursery_lookup(tool_input: dict) -> str:
    """Search Nature Hills Nursery and return formatted results."""
    from app.nursery.service import search_nursery

    quantity = tool_input.get("quantity", 1)
    result = await search_nursery(
        tool_input["plant_name"],
        tool_input.get("scientific_name"),
        quantity=quantity,
    )

    nursery = result.get("nursery", "Succulents Box")
    if result["products"]:
        lines = [f"{nursery} results for '{result['plant_name']}' (quantity: {quantity}):"]
        for p in result["products"]:
            price = p.get("price", "price not available")
            lines.append(f"- {p['name']} — {price} each")
            lines.append(f"  Product page: {p['url']}")
            if p.get("add_to_cart_url") and p["add_to_cart_url"] != p["url"]:
                lines.append(f"  ���� Add {quantity} to cart & go to checkout: {p['add_to_cart_url']}")
        total_price = None
        if result["products"][0].get("price"):
            try:
                unit = float(result["products"][0]["price"].replace("$", ""))
                total_price = unit * quantity
            except ValueError:
                pass
        if total_price:
            lines.append(f"\nEstimated total for {quantity}: ${total_price:.2f}")
        # Highlight the first cart link
        first_cart = next((p["add_to_cart_url"] for p in result["products"] if p.get("add_to_cart_url") and p["add_to_cart_url"] != p["url"]), None)
        if first_cart:
            lines.append(f"\nDirect add-to-cart link (opens cart with {quantity} items): {first_cart}")
        return "\n".join(lines)
    else:
        return (
            f"No exact products found for '{result['plant_name']}' at {nursery}. "
            f"The user can browse search results directly: {result['search_url']}"
        )


async def _execute_plant_search(tool_input: dict) -> str:
    """Execute a plant search against the local database and return formatted results."""
    from app.config.database import get_db

    conditions = []
    params: list = []

    if tool_input.get("query"):
        like = f"%{tool_input['query']}%"
        conditions.append("(common_name LIKE ? OR scientific_name LIKE ? OR fire_behavior_notes LIKE ?)")
        params.extend([like, like, like])

    valid_zones = {"zone_0_5ft", "zone_5_30ft", "zone_30_100ft", "zone_100ft_plus"}
    if tool_input.get("zone") in valid_zones:
        conditions.append(f"{tool_input['zone']} = 1")

    if tool_input.get("native"):
        conditions.append("is_native = 1")
    if tool_input.get("deer_resistant"):
        conditions.append("deer_resistant = 1")
    if tool_input.get("pollinator_support"):
        conditions.append("pollinator_support = 1")
    if tool_input.get("sun"):
        conditions.append("sun = ?")
        params.append(tool_input["sun"])
    if tool_input.get("water_need"):
        conditions.append("water_need = ?")
        params.append(tool_input["water_need"])

    conditions.append("is_noxious_weed = 0")
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    limit = min(tool_input.get("limit", 10), 20)

    async with get_db() as db:
        cursor = await db.execute(
            f"""
            SELECT common_name, scientific_name, plant_type,
                   zone_0_5ft, zone_5_30ft, zone_30_100ft, zone_100ft_plus,
                   water_need, is_native, deer_resistant, pollinator_support,
                   sun, mature_height_max_ft, fire_behavior_notes,
                   ashland_restricted, ashland_restriction_type
            FROM plants {where}
            ORDER BY (zone_0_5ft + zone_5_30ft) DESC, is_native DESC,
                     CASE water_need WHEN 'low' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END ASC,
                     common_name ASC
            LIMIT ? OFFSET 0
            """,
            (*params, limit),
        )
        rows = await cursor.fetchall()

        count_cursor = await db.execute(f"SELECT COUNT(*) FROM plants {where}", params)
        total = (await count_cursor.fetchone())[0]

    if not rows:
        return f"No plants found matching those criteria. Total plants in database: check if plant sync has been run."

    lines = [f"Found {total} plants matching criteria (showing top {len(rows)}):"]
    lines.append("")
    for row in rows:
        r = dict(row)
        zones = []
        if r["zone_0_5ft"]:
            zones.append("0-5ft")
        if r["zone_5_30ft"]:
            zones.append("5-30ft")
        if r["zone_30_100ft"]:
            zones.append("30-100ft")
        if r["zone_100ft_plus"]:
            zones.append("100ft+")

        traits = []
        if r["is_native"]:
            traits.append("Oregon native")
        if r["deer_resistant"]:
            traits.append("deer resistant")
        if r["pollinator_support"]:
            traits.append("pollinator")
        if r["water_need"]:
            traits.append(f"{r['water_need']} water")
        if r["sun"]:
            traits.append(f"{r['sun']} sun")
        if r["ashland_restricted"]:
            traits.append(f"Ashland restricted ({r['ashland_restriction_type']})")

        name = r["common_name"]
        sci = f" ({r['scientific_name']})" if r["scientific_name"] else ""
        ptype = f" [{r['plant_type']}]" if r["plant_type"] else ""
        height = f", max {r['mature_height_max_ft']}ft" if r["mature_height_max_ft"] else ""

        lines.append(f"- **{name}**{sci}{ptype}")
        lines.append(f"  Zones: {', '.join(zones) or 'none specified'}{height}")
        lines.append(f"  Traits: {', '.join(traits) or 'none'}")
        if r["fire_behavior_notes"]:
            lines.append(f"  Fire notes: {r['fire_behavior_notes']}")
        lines.append("")

    return "\n".join(lines)


async def _generate_claude(
    system_prompt: str,
    question: str,
    nws_alert: str | None = None,
) -> str:
    """Generate using Claude API with plant search tool use."""
    from anthropic import AsyncAnthropic

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    user_content = question
    if nws_alert:
        user_content = f"[Active NWS Alert: {nws_alert}]\n\n{question}"

    messages = [{"role": "user", "content": user_content}]

    # First call — may return text or a tool_use request
    response = await client.messages.create(
        model=settings.claude_model,
        max_tokens=4096,
        system=system_prompt,
        messages=messages,
        tools=[PLANT_SEARCH_TOOL, NURSERY_LOOKUP_TOOL],
    )

    tool_handlers = {
        "search_plants": _execute_plant_search,
        "nursery_lookup": _execute_nursery_lookup,
    }

    # Handle tool use loop (max 3 rounds to prevent runaway)
    for _ in range(3):
        if response.stop_reason != "tool_use":
            break

        # Collect all tool calls and execute them
        tool_results = []
        assistant_content = response.content
        for block in assistant_content:
            if block.type == "tool_use" and block.name in tool_handlers:
                result = await tool_handlers[block.name](block.input)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result,
                })

        if not tool_results:
            break

        messages.append({"role": "assistant", "content": assistant_content})
        messages.append({"role": "user", "content": tool_results})

        response = await client.messages.create(
            model=settings.claude_model,
            max_tokens=4096,
            system=system_prompt,
            messages=messages,
            tools=[PLANT_SEARCH_TOOL, NURSERY_LOOKUP_TOOL],
        )

    # Extract final text from response
    text_parts = [block.text for block in response.content if hasattr(block, "text")]
    return "\n".join(text_parts)


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
