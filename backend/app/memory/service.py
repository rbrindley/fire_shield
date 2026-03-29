"""Conversation memory service for persistent user context."""

import json

from app.config.database import get_db


async def get_memories(
    property_profile_id: str,
    memory_type: str | None = None,
    limit: int = 30,
) -> list[dict]:
    """Get conversation memories for a property profile."""
    async with get_db() as db:
        if memory_type:
            cursor = await db.execute(
                """
                SELECT * FROM conversation_memory
                WHERE property_profile_id = ? AND memory_type = ?
                ORDER BY created_at DESC LIMIT ?
                """,
                (property_profile_id, memory_type, limit),
            )
        else:
            cursor = await db.execute(
                """
                SELECT * FROM conversation_memory
                WHERE property_profile_id = ?
                ORDER BY created_at DESC LIMIT ?
                """,
                (property_profile_id, limit),
            )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


async def add_memory(
    property_profile_id: str,
    memory_type: str,
    memory_key: str,
    memory_value: str,
    metadata: dict | None = None,
) -> dict:
    """Add a conversation memory entry."""
    async with get_db() as db:
        cursor = await db.execute(
            """
            INSERT INTO conversation_memory
                (property_profile_id, memory_type, memory_key, memory_value, memory_metadata)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                property_profile_id,
                memory_type,
                memory_key,
                memory_value,
                json.dumps(metadata) if metadata else None,
            ),
        )
        await db.commit()
        memory_id = cursor.lastrowid

        cursor = await db.execute(
            "SELECT * FROM conversation_memory WHERE id = ?", (memory_id,)
        )
        row = await cursor.fetchone()
        return dict(row)


async def delete_memory(memory_id: int) -> bool:
    """Delete a conversation memory by ID."""
    async with get_db() as db:
        cursor = await db.execute(
            "SELECT id FROM conversation_memory WHERE id = ?", (memory_id,)
        )
        if not await cursor.fetchone():
            return False

        await db.execute("DELETE FROM conversation_memory WHERE id = ?", (memory_id,))
        await db.commit()
        return True


async def format_memory_context(property_profile_id: str) -> str | None:
    """Load and format memories as a string for injection into the RAG prompt."""
    memories = await get_memories(property_profile_id, limit=30)
    if not memories:
        return None

    lines = []
    for m in memories:
        lines.append(f"- [{m['memory_type']}] {m['memory_key']}: {m['memory_value']}")
    return "\n".join(lines)
