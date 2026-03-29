"""Pydantic models for query operations."""

from typing import Literal

from pydantic import BaseModel


class QueryRequest(BaseModel):
    """Query request payload."""

    question: str
    jurisdiction_code: str = "jackson_county"
    profile: Literal["simple", "pro", "agent"] = "simple"
    property_profile_id: str | None = None
    lat: float | None = None
    lng: float | None = None


class Citation(BaseModel):
    """Citation reference in a response."""

    chunk_id: str
    ref_number: int | None = None       # The [1], [2] footnote number (sequential)
    source_number: int | None = None    # Original source number from LLM context
    document_title: str
    section_title: str | None = None
    excerpt: str
    citation_type: Literal["structured_data", "retrieved_document", "fire_science_evidence"] = "retrieved_document"
    trust_tier: int = 4
    source_url: str | None = None


class IntentClassification(BaseModel):
    """Classified intent from the user's question."""

    primary_intent: Literal["map", "plants", "zones", "build", "property", "general"]
    confidence: float
    resource_tab: str


class ResourceLink(BaseModel):
    """A resource link suggested for the user."""

    title: str
    description: str
    intent_tag: str
    url: str | None = None


class QueryResponse(BaseModel):
    """Query response payload."""

    answer: str
    citations: list[Citation]
    jurisdiction_note: str | None = None
    nws_alert: str | None = None
    intent: IntentClassification | None = None
    resource_links: list[ResourceLink] = []
    profile_used: str
    retrieval_time_ms: int
    generation_time_ms: int
    total_time_ms: int
