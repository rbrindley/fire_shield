"""Memory routes for conversation memory CRUD."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.memory.service import get_memories, add_memory, delete_memory

router = APIRouter()


class MemoryCreate(BaseModel):
    memory_type: str
    memory_key: str
    memory_value: str
    metadata: dict | None = None


@router.get("/{property_profile_id}")
async def list_memories(
    property_profile_id: str,
    memory_type: str | None = None,
    limit: int = 30,
):
    """List conversation memories for a property profile."""
    memories = await get_memories(property_profile_id, memory_type, limit)
    return {"memories": memories, "count": len(memories)}


@router.post("/{property_profile_id}")
async def create_memory(property_profile_id: str, req: MemoryCreate):
    """Add a new conversation memory."""
    memory = await add_memory(
        property_profile_id,
        req.memory_type,
        req.memory_key,
        req.memory_value,
        req.metadata,
    )
    return memory


@router.delete("/{memory_id}")
async def remove_memory(memory_id: int):
    """Delete a conversation memory."""
    deleted = await delete_memory(memory_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Memory not found")
    return {"deleted": True}
