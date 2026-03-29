"""Structure-aware chunking for X12 documents."""

import re
import uuid
from dataclasses import dataclass


@dataclass
class Chunk:
    """Represents a document chunk."""

    id: str
    content: str
    page_start: int
    page_end: int
    section_title: str | None
    loop_id: str | None
    segment_codes: list[str]
    has_table: bool
    token_count: int


# X12 patterns for structure detection
LOOP_PATTERN = re.compile(r"\b(\d{4}[A-Z])\b")  # e.g., 2000A, 2100C
SEGMENT_PATTERN = re.compile(r"\b([A-Z]{2,3}\d?)\b")  # e.g., NM1, CLM, SV1
SECTION_HEADER_PATTERN = re.compile(r"^#{1,3}\s+(.+)$", re.MULTILINE)


def chunk_pages(pages: list[dict], max_tokens: int = 512) -> list[Chunk]:
    """Chunk pages into semantically meaningful units."""
    chunks = []
    current_section = None

    for page in pages:
        page_chunks = _chunk_page(
            page["content"],
            page["page_number"],
            current_section,
            page.get("has_table", False),
            max_tokens,
        )
        chunks.extend(page_chunks)

        # Update current section from last chunk
        if page_chunks:
            current_section = page_chunks[-1].section_title

    return chunks


def _chunk_page(
    content: str,
    page_number: int,
    current_section: str | None,
    has_table: bool,
    max_tokens: int,
) -> list[Chunk]:
    """Chunk a single page's content."""
    chunks = []

    # Detect section headers
    headers = list(SECTION_HEADER_PATTERN.finditer(content))

    if not headers:
        # No headers, chunk by size
        text_chunks = _split_by_size(content, max_tokens)
        for text in text_chunks:
            chunks.append(_create_chunk(text, page_number, current_section, has_table))
    else:
        # Chunk by sections
        positions = [(m.start(), m.group(1)) for m in headers]
        positions.append((len(content), None))

        for i, (start, section_title) in enumerate(positions[:-1]):
            end = positions[i + 1][0]
            section_content = content[start:end].strip()

            if section_title:
                current_section = section_title

            # Further split large sections
            text_chunks = _split_by_size(section_content, max_tokens)
            for text in text_chunks:
                # Check if this chunk contains a table
                chunk_has_table = has_table or ("|" in text and "---" in text)
                chunks.append(_create_chunk(text, page_number, current_section, chunk_has_table))

    return chunks


def _split_by_size(text: str, max_tokens: int) -> list[str]:
    """Split text into chunks of approximately max_tokens."""
    # Simple approximation: 1 token ≈ 4 characters
    max_chars = max_tokens * 4

    if len(text) <= max_chars:
        return [text] if text.strip() else []

    chunks = []
    paragraphs = text.split("\n\n")
    current_chunk = ""

    for para in paragraphs:
        if len(current_chunk) + len(para) > max_chars:
            if current_chunk:
                chunks.append(current_chunk.strip())
            current_chunk = para
        else:
            current_chunk += "\n\n" + para if current_chunk else para

    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    return chunks


def _create_chunk(
    content: str,
    page_number: int,
    section_title: str | None,
    has_table: bool,
) -> Chunk:
    """Create a Chunk object from content."""
    # Extract X12 patterns
    loop_ids = LOOP_PATTERN.findall(content)
    segment_codes = list(set(SEGMENT_PATTERN.findall(content)))

    # Use first loop ID found, or None
    loop_id = loop_ids[0] if loop_ids else None

    # Estimate token count
    token_count = len(content) // 4

    return Chunk(
        id=str(uuid.uuid4()),
        content=content,
        page_start=page_number,
        page_end=page_number,
        section_title=section_title,
        loop_id=loop_id,
        segment_codes=segment_codes,
        has_table=has_table,
        token_count=token_count,
    )


def merge_small_chunks(chunks: list[Chunk], min_tokens: int = 100) -> list[Chunk]:
    """Merge very small consecutive chunks."""
    if not chunks:
        return []

    merged = []
    current = chunks[0]

    for next_chunk in chunks[1:]:
        if (
            current.token_count < min_tokens
            and current.section_title == next_chunk.section_title
            and current.page_end == next_chunk.page_start
        ):
            # Merge
            current = Chunk(
                id=current.id,
                content=current.content + "\n\n" + next_chunk.content,
                page_start=current.page_start,
                page_end=next_chunk.page_end,
                section_title=current.section_title,
                loop_id=current.loop_id or next_chunk.loop_id,
                segment_codes=list(set(current.segment_codes + next_chunk.segment_codes)),
                has_table=current.has_table or next_chunk.has_table,
                token_count=current.token_count + next_chunk.token_count,
            )
        else:
            merged.append(current)
            current = next_chunk

    merged.append(current)
    return merged
