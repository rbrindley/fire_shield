"""Evidence routes for chunk details and context."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.models.documents import ChunkResponse
from app.auth.dependencies import get_current_user
from app.evidence.service import get_chunk_detail, get_surrounding_context

router = APIRouter()


@router.get("/chunk/{chunk_id}", response_model=ChunkResponse)
async def get_chunk(
    chunk_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get detailed information about a specific chunk."""
    chunk = await get_chunk_detail(chunk_id)

    if not chunk:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chunk not found",
        )

    return chunk


@router.get("/context/{chunk_id}")
async def get_context(
    chunk_id: str,
    pages_before: int = 1,
    pages_after: int = 1,
    current_user: dict = Depends(get_current_user),
):
    """Get surrounding context for a chunk."""
    context = await get_surrounding_context(chunk_id, pages_before, pages_after)

    if not context:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chunk not found",
        )

    return context


@router.get("/pdf/{doc_version_id}")
async def get_pdf_info(
    doc_version_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Get PDF file path for viewer."""
    from app.config.database import get_db

    async with get_db() as db:
        cursor = await db.execute(
            """
            SELECT dv.file_path, d.title, d.doc_type
            FROM document_versions dv
            JOIN documents d ON dv.document_id = d.id
            WHERE dv.id = ?
            """,
            (doc_version_id,),
        )
        row = await cursor.fetchone()

        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found",
            )

        return dict(row)
