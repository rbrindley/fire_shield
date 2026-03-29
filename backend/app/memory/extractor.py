"""Memory extraction from conversation turns."""

import json
import logging

from app.config import get_settings
from app.memory.service import add_memory

logger = logging.getLogger(__name__)
settings = get_settings()

EXTRACTION_PROMPT = """Extract structured memory items from this conversation exchange.

Categories:
- property_fact: details about the user's property (roof type, siding, slope, etc.)
- user_preference: preferences expressed (e.g., "prefers native plants", "budget-conscious")
- plant_interest: plants the user asked about positively
- plant_rejection: plants the user rejected and why
- plant_ordered: plants the user says they ordered or purchased
- action_explored: zone actions the user asked about or discussed
- action_completed: actions the user says they've done
- question_topic: notable topics asked about (e.g., "vent screening options", "grants")

Return a JSON array of objects with keys: memory_type, memory_key, memory_value
Return an empty array [] if nothing worth remembering.
Only extract facts explicitly stated — do not infer or assume.

USER QUESTION:
{question}

ASSISTANT ANSWER:
{answer}

JSON array:"""


async def extract_memories(
    question: str,
    answer: str,
    property_profile_id: str,
) -> list[dict]:
    """Extract and store conversation memories using a lightweight LLM call."""
    try:
        from anthropic import AsyncAnthropic

        client = AsyncAnthropic(api_key=settings.anthropic_api_key)

        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            messages=[
                {
                    "role": "user",
                    "content": EXTRACTION_PROMPT.format(
                        question=question[:2000],
                        answer=answer[:2000],
                    ),
                }
            ],
        )

        text = response.content[0].text.strip()

        # Parse JSON — handle markdown code fences
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        memories = json.loads(text)

        if not isinstance(memories, list):
            return []

        stored = []
        for m in memories:
            if all(k in m for k in ("memory_type", "memory_key", "memory_value")):
                result = await add_memory(
                    property_profile_id=property_profile_id,
                    memory_type=m["memory_type"],
                    memory_key=m["memory_key"],
                    memory_value=m["memory_value"],
                    metadata=m.get("metadata"),
                )
                stored.append(result)

        if stored:
            logger.info(
                f"Extracted {len(stored)} memories for profile {property_profile_id}"
            )
        return stored

    except Exception as e:
        logger.warning(f"Memory extraction failed: {e}")
        return []
