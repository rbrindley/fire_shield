"""Output profile templates for wildfire preparedness answer generation."""

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
