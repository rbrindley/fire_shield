"""PHI (Protected Health Information) detection scanner."""

import re
from app.models.query import PHIWarning


# PHI detection patterns
PHI_PATTERNS = {
    "ssn": [
        r"\b\d{3}-\d{2}-\d{4}\b",  # SSN with dashes
        r"\b\d{9}\b",  # SSN without dashes
    ],
    "phone": [
        r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b",  # Phone numbers
    ],
    "email": [
        r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
    ],
    "mrn": [
        r"\b[A-Z]{2,3}\d{6,10}\b",  # Common MRN patterns
    ],
    "dob_indicator": [
        r"\b(dob|date\s*of\s*birth|birthdate|born)\s*[:=]?\s*\d",
    ],
    "address": [
        r"\b\d+\s+[A-Za-z]+\s+(street|st|avenue|ave|road|rd|drive|dr|lane|ln|way|court|ct)\b",
    ],
}

# Keywords that increase PHI risk when near identifiers
PHI_KEYWORDS = [
    "patient",
    "member",
    "subscriber",
    "dependent",
    "beneficiary",
    "member id",
    "patient id",
    "account number",
]


async def scan_for_phi(text: str) -> PHIWarning:
    """Scan text for potential PHI patterns."""
    text_lower = text.lower()
    patterns_found = []

    # Check regex patterns
    for pattern_type, patterns in PHI_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, text, re.IGNORECASE):
                patterns_found.append(pattern_type)
                break

    # Check for PHI keywords near numbers
    for keyword in PHI_KEYWORDS:
        if keyword in text_lower:
            # Check if there are numbers nearby (within 50 chars)
            keyword_pos = text_lower.find(keyword)
            context = text_lower[max(0, keyword_pos - 50) : keyword_pos + len(keyword) + 50]
            if re.search(r"\d{4,}", context):
                patterns_found.append(f"keyword:{keyword}")

    detected = len(patterns_found) > 0

    return PHIWarning(
        detected=detected,
        patterns_found=list(set(patterns_found)),
        message="Potential PHI detected. Please review before sending to cloud API."
        if detected
        else None,
    )


async def scan_chunks_for_phi(chunks: list[dict]) -> PHIWarning:
    """Scan multiple chunks for PHI."""
    all_patterns = []

    for chunk in chunks:
        result = await scan_for_phi(chunk.get("content", ""))
        all_patterns.extend(result.patterns_found)

    patterns_found = list(set(all_patterns))
    detected = len(patterns_found) > 0

    return PHIWarning(
        detected=detected,
        patterns_found=patterns_found,
        message="Potential PHI detected in retrieved context." if detected else None,
    )
