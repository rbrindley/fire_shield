"""Pydantic models for document operations."""

from typing import Literal

from pydantic import BaseModel


class DocumentCreate(BaseModel):
    """Document creation payload."""

    filename: str
    doc_type: str | None = None  # Auto-detected if not provided
    doc_subtype: str | None = None  # For 837: I=Institutional, P=Professional, D=Dental
    doc_category: Literal["full_guide", "addendum", "errata"] = "full_guide"
    x12_version: str | None = None  # e.g., '005010X222A2'
    title: str | None = None
    description: str | None = None
    release_date: str | None = None  # ISO date string (publication date)
    effective_date: str | None = None  # ISO date string (when guide takes effect)
    source_org: str | None = None  # Auto-detected if not provided
    is_errata: bool = False
    errata_for_doc_id: int | None = None  # Reference to base document for erratas
    doc_type_confidence: str | None = None  # 'high', 'medium', 'low', 'manual'


class DocumentResponse(BaseModel):
    """Document response model."""

    id: int
    filename: str
    doc_type: str | None = None
    doc_subtype: str | None = None
    doc_category: str | None = "full_guide"
    x12_version: str | None = None
    title: str | None
    description: str | None
    release_date: str | None = None
    effective_date: str | None = None
    source_org: str | None = None
    is_errata: bool = False
    errata_for_doc_id: int | None = None
    is_active: bool
    created_at: str
    latest_version: int | None = None
    extraction_status: str | None = None
    doc_type_confidence: str | None = None
    page_count: int | None = None


class ChunkResponse(BaseModel):
    """Chunk response model."""

    id: str
    content: str
    page_start: int
    page_end: int
    section_title: str | None
    loop_id: str | None
    has_table: bool
    document_title: str
    doc_version_id: int | None = None


class IngestionStatus(BaseModel):
    """Ingestion status response."""

    doc_version_id: int
    status: Literal["pending", "queued", "processing", "completed", "failed"]
    progress_percent: float = 0.0
    current_step: str | None = None
    error_message: str | None = None
    total_pages: int | None = None
    processed_pages: int | None = None
    total_chunks: int | None = None
