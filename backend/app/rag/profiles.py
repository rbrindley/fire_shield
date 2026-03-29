"""Output profile templates for wildfire preparedness answer generation."""

import os
from functools import lru_cache

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))


@lru_cache(maxsize=1)
def _load_builders_md() -> str:
    """Load BUILDERS.md for injection into teacher context."""
    path = os.path.join(_REPO_ROOT, "BUILDERS.md")
    try:
        with open(path) as f:
            return f.read()
    except FileNotFoundError:
        return ""


FIRE_SHIELD_APP_CONTEXT = """
ABOUT FIRE SHIELD (use this to answer questions about the app itself):
Fire Shield is an open-source wildfire prevention assistant for Southern Oregon's Rogue Valley.
It combines fire science research, local building codes, and a 100+ fire-resistant plant database
to help homeowners protect properties using the Home Ignition Zone (HIZ) framework.

KEY FEATURES:
- AI chat advisor with cited sources (RAG system using Claude)
- Home Ignition Zone interactive map with zone rings (Leaflet + building footprints)
- Fire-resistant plant database with zone suitability, water needs, native status
- Zone action engine with seasonal priority boosting
- MCP server for AI agent integration (search_plants, get_zone_actions, nursery_lookup tools)
- Jurisdiction-aware: resolves address to city → county → state chain for scoped recommendations
- Nursery ordering agent: searches Succulents Box (Shopify) and generates add-to-cart links

ARCHITECTURE:
- Backend: FastAPI (Python) on port 8100 — RAG engine, plant search, zone actions, jurisdiction resolver
- Frontend: Next.js 16 (React 19) on port 3100 — two-panel dashboard with chat + resource tabs
- MCP Server: Node.js + MCP SDK (SSE transport) on port 3101
- Database: SQLite + Qdrant vector store
- Embeddings: BAAI/bge-large-en-v1.5

AGENT INTEGRATION PATHS:
1. llms.txt / llms-full.txt — paste full content into any LLM
2. REST API — /api/plants/search, /api/zones/, /api/query/, /api/jurisdiction/resolve
3. MCP Server — SSE endpoint for Claude Desktop / any MCP client
4. Content negotiation — Accept: text/markdown on any page returns Markdown

DATA AVAILABLE:
- 100+ fire-resistant plants with zone eligibility, water needs, native status, fire behavior notes
- 17 evidence-based actions across 5 HIZ layers with citations, cost/effort/time estimates
- 13 Southern Oregon jurisdictions with hierarchy chains
- Fire science evidence from IBHS, NFPA, CAL FIRE, Camp Fire / Marshall Fire / Almeda Fire studies
"""


PROFILES = {
    "simple": """Respond in plain, friendly language. Assume the homeowner has no fire safety background.
- Lead with the single most important action first
- Use short sentences and common words (avoid "defensible space", say "cleared area around the house")
- Explain WHY each action matters ("This matters because embers can travel a mile ahead of a fire")
- Keep the response to 3–5 key points maximum
- End with one concrete next step the person can take today""",

    "pro": """Respond with technical precision appropriate for a homeowner who has researched fire hardening.
- Reference specific code sections or guidance standards where relevant (e.g. "per ORS 477.015" or "NFPA 1144 Section 5.3")
- Include effort level, cost range, and time estimate for each action where sources support it
- Note jurisdiction-specific requirements vs. universal best practice
- Distinguish between "required" (code-mandated) and "recommended" (best practice)
- Use the HIZ layer framework explicitly: Layer 0 (structure), Layer 1 (0–5 ft), Layer 2 (5–30 ft), etc.
- Cite every factual claim with [n]""",

    "teacher": """You are assisting a teacher or educator who wants to teach students about wildfire preparedness, AI agents, and building technology projects.
- Answer questions about pedagogy, lesson planning, AI agent concepts, coding, and the Fire Shield app itself — not just wildfire topics
- When the question is about wildfire science or local code, use the retrieved context as usual
- When the question is about teaching methods, AI, coding, agent-building, or the Fire Shield app, draw on your general knowledge AND the Fire Shield app context provided below
- Suggest hands-on student projects and activities when relevant (see the BUILDERS GUIDE below for project ideas)
- Reference the Fire Shield platform, its API endpoints, and MCP server when discussing agent-building exercises
- Keep language accessible for educators who may not have a technical background
- Use encouraging, collaborative tone

""" + FIRE_SHIELD_APP_CONTEXT + """

BUILDERS GUIDE (for student projects and exercises):
""" + _load_builders_md(),

    "agent": """Respond in structured JSON. Format your entire response as valid JSON with this schema:
{
  "summary": "2-3 sentence plain-language summary",
  "priority_actions": [
    {
      "layer": 0,
      "action": "action title",
      "why": "why it matters",
      "effort": "zero_cost|low|moderate|high",
      "citations": [1, 2]
    }
  ],
  "jurisdiction_note": "jurisdiction-specific note or null",
  "confidence": "high|medium|low"
}
Use citations [n] within the JSON string values to reference sources. Output ONLY valid JSON, no prose.""",
}


def get_profile_instructions(profile: str) -> str:
    """Get instructions for the specified output profile."""
    return PROFILES.get(profile, PROFILES["simple"])
