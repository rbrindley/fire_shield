"""Wildfire corpus ingestion pipeline.

Extracts text from a PDF (file or URL), chunks it, and indexes into SQLite FTS5 + Qdrant.
Attaches jurisdiction and trust_tier metadata from the documents table.
"""

import logging
import uuid
from pathlib import Path

import httpx

from app.config.database import get_db

logger = logging.getLogger(__name__)


async def ingest_document(
    document_id: int,
    file_path: str | None = None,
    url: str | None = None,
) -> None:
    """Extract, chunk, and index a document.

    Reads jurisdiction and trust_tier from the documents table row (id = document_id).
    Creates a document_version record, then inserts chunks with doc_version_id.
    """
    # Load document metadata
    async with get_db() as db:
        cursor = await db.execute(
            "SELECT title, jurisdiction, trust_tier, source_url FROM documents WHERE id = ?",
            (document_id,),
        )
        row = await cursor.fetchone()
        if not row:
            raise ValueError(f"Document {document_id} not found")
        doc = dict(row)

    jurisdiction = doc["jurisdiction"]
    trust_tier = doc["trust_tier"]
    title = doc["title"]

    # Extract text
    if file_path and Path(file_path).exists():
        raw_text = _extract_pdf(file_path)
    elif url:
        raw_text = await _fetch_url_text(url)
    else:
        raise ValueError("Either file_path or url must be provided")

    if not raw_text.strip():
        raise ValueError("No text extracted from document")

    # Chunk text
    chunks = _chunk_text(raw_text)

    # Create document_version record
    async with get_db() as db:
        cursor = await db.execute(
            """
            INSERT INTO document_versions (document_id, version, extraction_status)
            VALUES (?, 1, 'complete')
            """,
            (document_id,),
        )
        version_id = cursor.lastrowid

        # Insert chunks
        for i, chunk in enumerate(chunks):
            chunk_id = str(uuid.uuid4())
            await db.execute(
                """
                INSERT INTO chunks (id, doc_version_id, chunk_index, content, content_hash,
                                    page_start, page_end, section_title, jurisdiction, trust_tier)
                VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?)
                """,
                (chunk_id, version_id, i, chunk["content"],
                 str(hash(chunk["content"]))[:16],
                 chunk.get("section_title"), jurisdiction, trust_tier),
            )
            chunk["id"] = chunk_id

        await db.execute(
            "UPDATE documents SET status = 'active', chunk_count = ? WHERE id = ?",
            (len(chunks), document_id),
        )
        await db.commit()

    # Index into Qdrant (non-fatal if unavailable)
    await _index_qdrant(chunks, jurisdiction, trust_tier)

    logger.info("Ingested %d chunks for document %d (%s)", len(chunks), document_id, title)


def _extract_pdf(file_path: str) -> str:
    """Extract text from a PDF file using PyMuPDF (fitz)."""
    import fitz  # PyMuPDF — already in pyproject.toml

    doc = fitz.open(file_path)
    pages = []
    for page in doc:
        text = page.get_text()
        if text.strip():
            pages.append(text)
    doc.close()
    return "\n\n".join(pages)


async def _fetch_url_text(url: str) -> str:
    """Fetch text content from a URL (HTML or PDF)."""
    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        resp = await client.get(url, headers={"User-Agent": "fire-shield-ingest/1.0"})
        resp.raise_for_status()
        content_type = resp.headers.get("content-type", "")

        if "pdf" in content_type:
            import tempfile

            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
                f.write(resp.content)
                tmp_path = f.name
            try:
                return _extract_pdf(tmp_path)
            finally:
                Path(tmp_path).unlink(missing_ok=True)
        else:
            from html.parser import HTMLParser

            class TextExtractor(HTMLParser):
                def __init__(self):
                    super().__init__()
                    self.texts: list[str] = []
                    self._skip = False

                def handle_starttag(self, tag, attrs):
                    if tag in ("script", "style", "nav", "footer"):
                        self._skip = True

                def handle_endtag(self, tag):
                    if tag in ("script", "style", "nav", "footer"):
                        self._skip = False

                def handle_data(self, data):
                    if not self._skip and data.strip():
                        self.texts.append(data.strip())

            parser = TextExtractor()
            parser.feed(resp.text)
            return "\n".join(parser.texts)


def _chunk_text(text: str, chunk_size: int = 800) -> list[dict]:
    """Split text into overlapping chunks with section detection."""
    import re

    section_pattern = re.compile(
        r"^(?:\d+\.[\d.]*\s+[A-Z]|[A-Z][A-Z\s]{4,}$|Section\s+\d|Layer\s+\d)",
        re.MULTILINE,
    )

    paragraphs = re.split(r"\n{2,}", text)
    current_section: str | None = None
    chunks: list[dict] = []
    current_parts: list[str] = []
    current_len = 0
    chunk_index = 0

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        if section_pattern.match(para) and len(para) < 200:
            current_section = para[:100]

        para_len = len(para)

        if current_len + para_len > chunk_size and current_parts:
            chunks.append({
                "index": chunk_index,
                "content": " ".join(current_parts)[:chunk_size * 2],
                "section_title": current_section,
            })
            chunk_index += 1
            current_parts = current_parts[-1:] if current_parts else []
            current_len = len(current_parts[0]) if current_parts else 0

        current_parts.append(para)
        current_len += para_len

    if current_parts:
        chunks.append({
            "index": chunk_index,
            "content": " ".join(current_parts)[:chunk_size * 2],
            "section_title": current_section,
        })

    return chunks


async def _index_qdrant(chunks: list[dict], jurisdiction: str, trust_tier: int) -> None:
    """Index chunks into Qdrant with jurisdiction payload. Non-fatal if Qdrant is unavailable."""
    try:
        from app.config import get_settings
        from app.rag.embedder import get_embedder
        from qdrant_client import QdrantClient
        from qdrant_client.models import PointStruct

        settings = get_settings()
        embedder = get_embedder()
        texts = [c["content"] for c in chunks]
        embeddings = await embedder.embed(texts)

        client = QdrantClient(host=settings.qdrant_host, port=settings.qdrant_port)

        # Ensure collection exists (lazy init)
        from qdrant_client.models import Distance, VectorParams

        collection_names = [c.name for c in client.get_collections().collections]
        if settings.qdrant_collection not in collection_names:
            client.create_collection(
                collection_name=settings.qdrant_collection,
                vectors_config=VectorParams(
                    size=len(embeddings[0]),
                    distance=Distance.COSINE,
                ),
            )
            logger.info("Created Qdrant collection '%s'", settings.qdrant_collection)

        points = [
            PointStruct(
                id=str(uuid.uuid4()),
                vector=emb,
                payload={
                    "chunk_id": chunk["id"],
                    "jurisdiction": jurisdiction,
                    "trust_tier": trust_tier,
                    "section_title": chunk.get("section_title"),
                },
            )
            for chunk, emb in zip(chunks, embeddings)
        ]

        client.upsert(collection_name=settings.qdrant_collection, points=points)
        logger.info("Indexed %d chunks into Qdrant", len(points))
    except Exception as e:
        logger.warning("Qdrant indexing failed (non-fatal): %s", e)
