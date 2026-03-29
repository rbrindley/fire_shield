"""Document ingestion routes for wildfire corpus management."""

import logging
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.config import get_settings
from app.config.database import get_db

router = APIRouter()
settings = get_settings()
logger = logging.getLogger(__name__)


class IngestRequest(BaseModel):
    url: str | None = None
    title: str
    jurisdiction: str
    trust_tier: int
    source_url: str | None = None
    document_date: str | None = None


class IngestResponse(BaseModel):
    document_id: int
    corpus_source_id: int
    status: str
    message: str


async def _run_ingest_pipeline(document_id: int, corpus_source_id: int, file_path: str | None, url: str | None):
    """Background task: extract → chunk → index a document."""
    from app.ingest.pipeline import ingest_document

    try:
        await ingest_document(document_id=document_id, file_path=file_path, url=url)
        async with get_db() as db:
            await db.execute(
                "UPDATE corpus_sources SET status = 'active' WHERE id = ?",
                (corpus_source_id,),
            )
            await db.commit()
        logger.info("Ingest complete for document %d", document_id)
    except Exception as e:
        logger.error("Ingest failed for document %d: %s", document_id, e)
        async with get_db() as db:
            await db.execute(
                "UPDATE documents SET status = 'error' WHERE id = ?",
                (document_id,),
            )
            await db.execute(
                "UPDATE corpus_sources SET status = 'error', error_message = ? WHERE id = ?",
                (str(e), corpus_source_id),
            )
            await db.commit()


async def _create_document_record(
    title: str, jurisdiction: str, trust_tier: int,
    source_url: str | None, document_date: str | None
) -> tuple[int, int]:
    """Insert document + corpus_source records. Returns (document_id, corpus_source_id)."""
    now = datetime.now(timezone.utc).isoformat()
    async with get_db() as db:
        cursor = await db.execute(
            """
            INSERT INTO documents (title, jurisdiction, trust_tier, source_url, document_date, status, ingested_at)
            VALUES (?, ?, ?, ?, ?, 'pending', ?)
            """,
            (title, jurisdiction, trust_tier, source_url, document_date, now),
        )
        document_id = cursor.lastrowid

        cursor = await db.execute(
            """
            INSERT INTO corpus_sources (title, source_url, jurisdiction, trust_tier, document_date, status, document_id)
            VALUES (?, ?, ?, ?, ?, 'pending', ?)
            """,
            (title, source_url, jurisdiction, trust_tier, document_date, document_id),
        )
        corpus_source_id = cursor.lastrowid
        await db.commit()

    return document_id, corpus_source_id


@router.post("/url", response_model=IngestResponse)
async def ingest_url(
    background_tasks: BackgroundTasks,
    request: IngestRequest,
):
    """Ingest a document by URL with jurisdiction and trust tier metadata."""
    if not request.url:
        raise HTTPException(status_code=400, detail="URL is required")

    document_id, corpus_source_id = await _create_document_record(
        title=request.title,
        jurisdiction=request.jurisdiction,
        trust_tier=request.trust_tier,
        source_url=request.url,
        document_date=request.document_date,
    )

    background_tasks.add_task(
        _run_ingest_pipeline, document_id, corpus_source_id, None, request.url
    )

    return IngestResponse(
        document_id=document_id,
        corpus_source_id=corpus_source_id,
        status="pending",
        message=f"Ingestion started for: {request.title}",
    )


@router.post("/upload", response_model=IngestResponse)
async def ingest_upload(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: str = Form(...),
    jurisdiction: str = Form(...),
    trust_tier: int = Form(...),
    source_url: str = Form(None),
    document_date: str = Form(None),
):
    """Ingest a PDF file upload."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    document_id, corpus_source_id = await _create_document_record(
        title=title,
        jurisdiction=jurisdiction,
        trust_tier=trust_tier,
        source_url=source_url,
        document_date=document_date,
    )

    # Save uploaded file
    upload_dir = Path("data/uploads")
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = str(upload_dir / f"doc_{document_id}.pdf")
    content = await file.read()
    Path(file_path).write_bytes(content)

    background_tasks.add_task(
        _run_ingest_pipeline, document_id, corpus_source_id, file_path, None
    )

    return IngestResponse(
        document_id=document_id,
        corpus_source_id=corpus_source_id,
        status="pending",
        message=f"Ingestion started for: {title}",
    )


@router.post("/reingest/{corpus_source_id}")
async def reingest_source(
    corpus_source_id: int,
    background_tasks: BackgroundTasks,
):
    """Re-ingest an existing corpus source (clears old chunks, re-runs pipeline)."""
    async with get_db() as db:
        cursor = await db.execute(
            "SELECT id, title, source_url, jurisdiction, trust_tier, document_id FROM corpus_sources WHERE id = ?",
            (corpus_source_id,),
        )
        source = await cursor.fetchone()
        if not source:
            raise HTTPException(status_code=404, detail="Corpus source not found")

        source = dict(source)
        document_id = source["document_id"]
        if not source["source_url"]:
            raise HTTPException(status_code=400, detail="No source URL to re-ingest from")

        if document_id:
            # Clear old chunks and versions for this document
            # Drop FTS triggers to avoid content-mismatch errors, clean up, then restore
            await db.execute("DROP TRIGGER IF EXISTS chunks_ad")
            await db.execute("DROP TRIGGER IF EXISTS chunks_au")
            await db.execute("DROP TRIGGER IF EXISTS chunks_ai")

            # Get chunk rowids to remove from FTS
            cursor2 = await db.execute(
                "SELECT rowid FROM chunks WHERE doc_version_id IN (SELECT id FROM document_versions WHERE document_id = ?)",
                (document_id,),
            )
            rowids = [r[0] for r in await cursor2.fetchall()]
            for rid in rowids:
                await db.execute("DELETE FROM chunks_fts WHERE rowid = ?", (rid,))

            await db.execute(
                "DELETE FROM chunks WHERE doc_version_id IN (SELECT id FROM document_versions WHERE document_id = ?)",
                (document_id,),
            )
            await db.execute(
                "DELETE FROM document_versions WHERE document_id = ?",
                (document_id,),
            )
            await db.execute(
                "UPDATE documents SET status = 'pending', chunk_count = 0 WHERE id = ?",
                (document_id,),
            )

            # Restore FTS triggers
            await db.execute("""
                CREATE TRIGGER chunks_ai AFTER INSERT ON chunks BEGIN
                    INSERT INTO chunks_fts(rowid, chunk_id, content, section_title, jurisdiction)
                    VALUES (NEW.rowid, NEW.id, NEW.content, NEW.section_title, NEW.jurisdiction);
                END
            """)
            await db.execute("""
                CREATE TRIGGER chunks_ad AFTER DELETE ON chunks BEGIN
                    INSERT INTO chunks_fts(chunks_fts, rowid, chunk_id, content, section_title, jurisdiction)
                    VALUES ('delete', OLD.rowid, OLD.id, OLD.content, OLD.section_title, OLD.jurisdiction);
                END
            """)
            await db.execute("""
                CREATE TRIGGER chunks_au AFTER UPDATE ON chunks BEGIN
                    INSERT INTO chunks_fts(chunks_fts, rowid, chunk_id, content, section_title, jurisdiction)
                    VALUES ('delete', OLD.rowid, OLD.id, OLD.content, OLD.section_title, OLD.jurisdiction);
                    INSERT INTO chunks_fts(rowid, chunk_id, content, section_title, jurisdiction)
                    VALUES (NEW.rowid, NEW.id, NEW.content, NEW.section_title, NEW.jurisdiction);
                END
            """)
        else:
            # No document record yet — create one
            cursor = await db.execute(
                """
                INSERT INTO documents (title, jurisdiction, trust_tier, source_url, status, ingested_at)
                VALUES (?, ?, ?, ?, 'pending', ?)
                """,
                (source["title"], source["jurisdiction"], source["trust_tier"],
                 source["source_url"], datetime.now(timezone.utc).isoformat()),
            )
            document_id = cursor.lastrowid
            await db.execute(
                "UPDATE corpus_sources SET document_id = ? WHERE id = ?",
                (document_id, corpus_source_id),
            )

        await db.execute(
            "UPDATE corpus_sources SET status = 'pending' WHERE id = ?",
            (corpus_source_id,),
        )
        await db.commit()

    background_tasks.add_task(
        _run_ingest_pipeline, document_id, corpus_source_id, None, source["source_url"]
    )

    return IngestResponse(
        document_id=document_id,
        corpus_source_id=corpus_source_id,
        status="pending",
        message=f"Re-ingestion started for: {source['title']}",
    )


@router.get("/status/{document_id}")
async def ingest_status(document_id: int):
    """Check ingestion status for a document."""
    async with get_db() as db:
        cursor = await db.execute(
            "SELECT id, title, jurisdiction, trust_tier, status, ingested_at, chunk_count FROM documents WHERE id = ?",
            (document_id,),
        )
        row = await cursor.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Document not found")

    return dict(row)
