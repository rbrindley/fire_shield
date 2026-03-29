"""Indexing chunks to SQLite and Qdrant."""

import json

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

from app.config import get_settings
from app.database import get_db
from app.rag.embedder import get_embedder
from app.ingest.chunker import Chunk

settings = get_settings()


async def index_chunks(chunks: list[Chunk], doc_version_id: int) -> None:
    """Index chunks to SQLite and Qdrant."""
    # Index to SQLite
    await _index_to_sqlite(chunks, doc_version_id)

    # Generate embeddings and index to Qdrant
    await _index_to_qdrant(chunks)


async def _index_to_sqlite(chunks: list[Chunk], doc_version_id: int) -> None:
    """Insert chunks into SQLite with FTS."""
    async with get_db() as db:
        for i, chunk in enumerate(chunks):
            content_hash = _hash_content(chunk.content)

            await db.execute(
                """
                INSERT INTO chunks (
                    id, doc_version_id, chunk_index, content, content_hash,
                    page_start, page_end, section_title, loop_id,
                    segment_codes, has_table, token_count
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    chunk.id,
                    doc_version_id,
                    i,
                    chunk.content,
                    content_hash,
                    chunk.page_start,
                    chunk.page_end,
                    chunk.section_title,
                    chunk.loop_id,
                    json.dumps(chunk.segment_codes),
                    int(chunk.has_table),
                    chunk.token_count,
                ),
            )

        await db.commit()


async def _index_to_qdrant(chunks: list[Chunk]) -> None:
    """Generate embeddings and index to Qdrant."""
    embedder = get_embedder()

    # Generate embeddings
    texts = [chunk.content for chunk in chunks]
    embeddings = await embedder.embed(texts)

    # Connect to Qdrant
    client = QdrantClient(host=settings.qdrant_host, port=settings.qdrant_port)

    # Ensure collection exists
    collections = client.get_collections().collections
    collection_names = [c.name for c in collections]

    if settings.qdrant_collection not in collection_names:
        client.create_collection(
            collection_name=settings.qdrant_collection,
            vectors_config=VectorParams(
                size=len(embeddings[0]),  # 1024 for BGE-large
                distance=Distance.COSINE,
            ),
        )

    # Upsert points
    points = [
        PointStruct(
            id=chunk.id,
            vector=embedding,
            payload={
                "chunk_id": chunk.id,
                "section_title": chunk.section_title,
                "loop_id": chunk.loop_id,
                "page_start": chunk.page_start,
                "page_end": chunk.page_end,
            },
        )
        for chunk, embedding in zip(chunks, embeddings)
    ]

    client.upsert(collection_name=settings.qdrant_collection, points=points)


async def delete_document_chunks(doc_version_id: int) -> None:
    """Delete all chunks for a document version."""
    async with get_db() as db:
        # Get chunk IDs for Qdrant deletion
        cursor = await db.execute(
            "SELECT id FROM chunks WHERE doc_version_id = ?",
            (doc_version_id,),
        )
        rows = await cursor.fetchall()
        chunk_ids = [row["id"] for row in rows]

        # Delete from SQLite
        await db.execute(
            "DELETE FROM chunks WHERE doc_version_id = ?",
            (doc_version_id,),
        )
        await db.commit()

    # Delete from Qdrant
    if chunk_ids:
        client = QdrantClient(host=settings.qdrant_host, port=settings.qdrant_port)
        client.delete(
            collection_name=settings.qdrant_collection,
            points_selector=chunk_ids,
        )


def _hash_content(content: str) -> str:
    """Generate hash for content deduplication."""
    import hashlib

    return hashlib.sha256(content.encode()).hexdigest()[:16]


async def delete_single_chunk(chunk_id: str) -> bool:
    """Delete a single chunk by ID from both SQLite and Qdrant.
    
    Args:
        chunk_id: The UUID of the chunk to delete
        
    Returns:
        True if chunk was found and deleted, False if not found
    """
    async with get_db() as db:
        # Check if chunk exists
        cursor = await db.execute(
            "SELECT id FROM chunks WHERE id = ?",
            (chunk_id,),
        )
        row = await cursor.fetchone()
        
        if not row:
            return False
        
        # Delete from SQLite (FTS trigger handles chunks_fts)
        await db.execute("DELETE FROM chunks WHERE id = ?", (chunk_id,))
        await db.commit()
    
    # Delete from Qdrant
    client = QdrantClient(host=settings.qdrant_host, port=settings.qdrant_port)
    client.delete(
        collection_name=settings.qdrant_collection,
        points_selector=[chunk_id],
    )
    
    return True


async def delete_document_and_all_versions(document_id: int) -> dict:
    """Delete a document and ALL its versions, chunks, and embeddings.
    
    Use with caution - this is irreversible!
    
    Args:
        document_id: The document ID to delete
        
    Returns:
        Dict with counts of deleted items
    """
    deleted = {"versions": 0, "chunks": 0}
    
    async with get_db() as db:
        # Get all version IDs
        cursor = await db.execute(
            "SELECT id FROM document_versions WHERE document_id = ?",
            (document_id,),
        )
        version_rows = await cursor.fetchall()
        version_ids = [row[0] for row in version_rows]
        
        # Get all chunk IDs for Qdrant deletion
        if version_ids:
            placeholders = ",".join("?" * len(version_ids))
            cursor = await db.execute(
                f"SELECT id FROM chunks WHERE doc_version_id IN ({placeholders})",
                version_ids,
            )
            chunk_rows = await cursor.fetchall()
            chunk_ids = [row[0] for row in chunk_rows]
            deleted["chunks"] = len(chunk_ids)
            
            # Delete chunks from Qdrant
            if chunk_ids:
                client = QdrantClient(host=settings.qdrant_host, port=settings.qdrant_port)
                client.delete(
                    collection_name=settings.qdrant_collection,
                    points_selector=chunk_ids,
                )
            
            # Delete from tables with FK to document_versions (without CASCADE)
            await db.execute(
                f"DELETE FROM ingestion_traces WHERE doc_version_id IN ({placeholders})",
                version_ids,
            )
        
        # Clear any errata references to this document
        await db.execute(
            "UPDATE documents SET errata_for_doc_id = NULL WHERE errata_for_doc_id = ?",
            (document_id,),
        )
        
        # Clear cloud_instance_events references (FK without CASCADE)
        await db.execute(
            "UPDATE cloud_instance_events SET document_id = NULL, document_title = NULL WHERE document_id = ?",
            (document_id,),
        )
        
        # Delete from SQLite (CASCADE handles chunks, extraction_checkpoints, cloud_extraction_audit)
        await db.execute(
            "DELETE FROM document_versions WHERE document_id = ?",
            (document_id,),
        )
        deleted["versions"] = len(version_ids)
        
        await db.execute("DELETE FROM documents WHERE id = ?", (document_id,))
        await db.commit()
    
    return deleted


async def replace_chunk_content(
    chunk_id: str,
    new_content: str,
    new_section_title: str | None = None,
) -> bool:
    """Replace the content of a single chunk and re-embed.
    
    Useful for fixing corrupted or incorrect chunks without
    re-processing the entire document.
    
    Args:
        chunk_id: The UUID of the chunk to update
        new_content: The corrected content
        new_section_title: Optional new section title
        
    Returns:
        True if successful, False if chunk not found
    """
    async with get_db() as db:
        # Check if chunk exists
        cursor = await db.execute(
            "SELECT id FROM chunks WHERE id = ?",
            (chunk_id,),
        )
        row = await cursor.fetchone()
        
        if not row:
            return False
        
        # Update SQLite
        content_hash = _hash_content(new_content)
        
        if new_section_title:
            await db.execute(
                """
                UPDATE chunks 
                SET content = ?, content_hash = ?, section_title = ?
                WHERE id = ?
                """,
                (new_content, content_hash, new_section_title, chunk_id),
            )
        else:
            await db.execute(
                "UPDATE chunks SET content = ?, content_hash = ? WHERE id = ?",
                (new_content, content_hash, chunk_id),
            )
        await db.commit()
    
    # Re-embed and update Qdrant
    embedder = get_embedder()
    embeddings = await embedder.embed([new_content])
    
    client = QdrantClient(host=settings.qdrant_host, port=settings.qdrant_port)
    client.upsert(
        collection_name=settings.qdrant_collection,
        points=[
            PointStruct(
                id=chunk_id,
                vector=embeddings[0],
                payload={"chunk_id": chunk_id, "section_title": new_section_title},
            )
        ],
    )
    
    return True


async def rebuild_qdrant_for_document(doc_version_id: int) -> dict:
    """Rebuild Qdrant vectors from SQLite chunks for a specific document.
    
    Use when Qdrant vectors are missing or out of sync with SQLite.
    
    Args:
        doc_version_id: The document version ID to rebuild
        
    Returns:
        Dict with rebuild statistics
    """
    import logging
    logger = logging.getLogger(__name__)
    
    result = {
        "doc_version_id": doc_version_id,
        "chunks_found": 0,
        "vectors_created": 0,
        "status": "pending",
        "error": None,
    }
    
    async with get_db() as db:
        # Get all chunks for this document version
        cursor = await db.execute(
            """
            SELECT id, content, section_title, loop_id, page_start, page_end
            FROM chunks WHERE doc_version_id = ?
            ORDER BY chunk_index
            """,
            (doc_version_id,)
        )
        rows = await cursor.fetchall()
        
        if not rows:
            result["status"] = "no_chunks"
            result["error"] = "No chunks found for this document version"
            return result
        
        result["chunks_found"] = len(rows)
    
    try:
        # Get embedder
        embedder = get_embedder()
        
        # Generate embeddings in batches
        batch_size = 32
        all_points = []
        
        for i in range(0, len(rows), batch_size):
            batch = rows[i:i + batch_size]
            texts = [row["content"] for row in batch]
            embeddings = await embedder.embed(texts)
            
            for row, embedding in zip(batch, embeddings):
                all_points.append(
                    PointStruct(
                        id=row["id"],
                        vector=embedding,
                        payload={
                            "chunk_id": row["id"],
                            "section_title": row["section_title"],
                            "loop_id": row["loop_id"],
                            "page_start": row["page_start"],
                            "page_end": row["page_end"],
                        },
                    )
                )
        
        # Connect to Qdrant and ensure collection exists
        client = QdrantClient(host=settings.qdrant_host, port=settings.qdrant_port)
        
        collections = client.get_collections().collections
        collection_names = [c.name for c in collections]
        
        if settings.qdrant_collection not in collection_names:
            # Get embedding dimension from first point
            client.create_collection(
                collection_name=settings.qdrant_collection,
                vectors_config=VectorParams(
                    size=len(all_points[0].vector),
                    distance=Distance.COSINE,
                ),
            )
        
        # Upsert all points
        client.upsert(
            collection_name=settings.qdrant_collection,
            points=all_points,
        )
        
        result["vectors_created"] = len(all_points)
        result["status"] = "success"
        logger.info(f"Rebuilt Qdrant for doc_version_id={doc_version_id}: {len(all_points)} vectors")
        
    except Exception as e:
        logger.error(f"Qdrant rebuild failed for doc_version_id={doc_version_id}: {e}")
        result["status"] = "error"
        result["error"] = str(e)
    
    return result


async def rebuild_qdrant_from_sqlite() -> dict:
    """Rebuild all Qdrant vectors from SQLite chunks.
    
    Use after restoring SQLite from backup or when Qdrant is corrupted.
    
    Returns:
        Dict with rebuild statistics
    """
    import logging
    logger = logging.getLogger(__name__)
    
    result = {
        "documents_processed": 0,
        "total_chunks": 0,
        "total_vectors": 0,
        "errors": [],
    }
    
    async with get_db() as db:
        # Get all active document versions
        cursor = await db.execute(
            """
            SELECT dv.id as version_id, d.filename
            FROM document_versions dv
            JOIN documents d ON dv.document_id = d.id
            WHERE d.is_active = 1
            """
        )
        versions = await cursor.fetchall()
    
    logger.info(f"Rebuilding Qdrant for {len(versions)} document versions...")
    
    for version in versions:
        try:
            rebuild_result = await rebuild_qdrant_for_document(version["version_id"])
            
            if rebuild_result["status"] == "success":
                result["documents_processed"] += 1
                result["total_chunks"] += rebuild_result["chunks_found"]
                result["total_vectors"] += rebuild_result["vectors_created"]
            elif rebuild_result["status"] == "no_chunks":
                logger.warning(f"No chunks for {version['filename']} (version {version['version_id']})")
            else:
                result["errors"].append(f"{version['filename']}: {rebuild_result['error']}")
                
        except Exception as e:
            result["errors"].append(f"{version['filename']}: {str(e)}")
    
    logger.info(f"Qdrant rebuild complete: {result['documents_processed']} docs, {result['total_vectors']} vectors")
    
    return result
