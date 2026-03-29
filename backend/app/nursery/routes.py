"""Nursery search routes."""

from fastapi import APIRouter

from app.nursery.service import search_nursery

router = APIRouter()


@router.get("/search")
async def nursery_search(
    plant: str,
    scientific_name: str | None = None,
    quantity: int = 1,
):
    """Search Nature Hills Nursery for a plant by name."""
    result = await search_nursery(plant, scientific_name, quantity=quantity)
    return result
