"""Evidence service for fetching chunk details and context."""

from app.database import get_db
from app.models.documents import ChunkResponse


async def get_chunk_detail(chunk_id: str) -> ChunkResponse | None:
    """Get detailed information about a chunk."""
    async with get_db() as db:
        cursor = await db.execute(
            """
            SELECT c.*, d.title as doc_title
            FROM chunks c
            JOIN document_versions dv ON c.doc_version_id = dv.id
            JOIN documents d ON dv.document_id = d.id
            WHERE c.id = ?
            """,
            (chunk_id,),
        )
        row = await cursor.fetchone()

        if not row:
            return None

        row_dict = dict(row)
        return ChunkResponse(
            id=row_dict["id"],
            content=row_dict["content"],
            page_start=row_dict["page_start"],
            page_end=row_dict["page_end"],
            section_title=row_dict["section_title"],
            loop_id=row_dict["loop_id"],
            has_table=bool(row_dict["has_table"]),
            document_title=row_dict["doc_title"],
            doc_version_id=row_dict["doc_version_id"],
        )


async def get_surrounding_context(
    chunk_id: str,
    pages_before: int = 1,
    pages_after: int = 1,
) -> dict | None:
    """Get chunks from surrounding pages for context."""
    async with get_db() as db:
        # Get the target chunk
        cursor = await db.execute(
            "SELECT * FROM chunks WHERE id = ?",
            (chunk_id,),
        )
        target = await cursor.fetchone()

        if not target:
            return None

        target_dict = dict(target)
        page_start = target_dict["page_start"]
        page_end = target_dict["page_end"]
        doc_version_id = target_dict["doc_version_id"]

        # Get surrounding chunks
        cursor = await db.execute(
            """
            SELECT * FROM chunks
            WHERE doc_version_id = ?
              AND page_start >= ?
              AND page_end <= ?
            ORDER BY page_start, chunk_index
            """,
            (
                doc_version_id,
                page_start - pages_before,
                page_end + pages_after,
            ),
        )
        rows = await cursor.fetchall()

        chunks = [dict(row) for row in rows]

        return {
            "target_chunk_id": chunk_id,
            "target_page_start": page_start,
            "target_page_end": page_end,
            "context_chunks": chunks,
        }
