"""Auto-detect X12 document type from PDF content.

This module extracts document metadata from PDF content (never filenames)
and attempts to determine the X12 transaction type.
"""

import logging
import re
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

# X12 version code to document type mapping
# Format: Xnnn -> {doc_type, optional doc_subtype}
X12_VERSION_MAP = {
    # 276/277 - Claim Status
    "X212": {"doc_type": "276"},
    # 278 - Prior Authorization
    "X217": {"doc_type": "278"},
    # 834 - Benefit Enrollment
    "X220": {"doc_type": "834"},
    # 835 - Claim Payment/Remittance
    "X221": {"doc_type": "835"},
    # 837P - Professional Claim
    "X222": {"doc_type": "837", "doc_subtype": "P"},
    # 837I - Institutional Claim
    "X223": {"doc_type": "837", "doc_subtype": "I"},
    # 837D - Dental Claim
    "X224": {"doc_type": "837", "doc_subtype": "D"},
    # 270/271 - Eligibility
    "X279": {"doc_type": "270"},
    # 820 - Payroll Deduction
    "X218": {"doc_type": "820"},
    # 997/999 - Functional Acknowledgment
    "X231": {"doc_type": "999"},
}

# Keywords that indicate specific transaction types
# Each entry: {keyword: {doc_type, optional doc_subtype}}
CONTENT_KEYWORDS = {
    # 834
    "benefit enrollment": {"doc_type": "834"},
    "enrollment and maintenance": {"doc_type": "834"},
    # 835
    "remittance advice": {"doc_type": "835"},
    "claim payment": {"doc_type": "835"},
    "health care claim payment": {"doc_type": "835"},
    # 837
    "health care claim": {"doc_type": "837"},
    "professional claim": {"doc_type": "837", "doc_subtype": "P"},
    "institutional claim": {"doc_type": "837", "doc_subtype": "I"},
    "dental claim": {"doc_type": "837", "doc_subtype": "D"},
    # 278
    "prior authorization": {"doc_type": "278"},
    "health care services review": {"doc_type": "278"},
    "certification and authorization": {"doc_type": "278"},
    # 270/271
    "eligibility inquiry": {"doc_type": "270"},
    "eligibility response": {"doc_type": "271"},
    "eligibility benefit": {"doc_type": "270"},
    # 276/277
    "claim status inquiry": {"doc_type": "276"},
    "claim status response": {"doc_type": "277"},
    # 820
    "payroll deducted": {"doc_type": "820"},
    "premium payment": {"doc_type": "820"},
    # 999
    "functional acknowledgment": {"doc_type": "999"},
    "implementation acknowledgment": {"doc_type": "999"},
}


@dataclass
class DetectionResult:
    """Result of document type detection."""
    doc_type: str | None = None
    doc_subtype: str | None = None
    x12_version: str | None = None
    confidence: str | None = None  # 'high', 'medium', 'low'
    detection_source: str | None = None  # 'x12_version', 'content_keywords'
    effective_date: str | None = None
    release_date: str | None = None  # Distinct from effective_date (publication vs compliance)
    source_org: str | None = None
    page_count: int | None = None
    title: str | None = None
    doc_category: str | None = None  # 'full_guide', 'addendum', 'errata'
    description: str | None = None

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "doc_type": self.doc_type,
            "doc_subtype": self.doc_subtype,
            "x12_version": self.x12_version,
            "confidence": self.confidence,
            "detection_source": self.detection_source,
            "effective_date": self.effective_date,
            "release_date": self.release_date,
            "source_org": self.source_org,
            "page_count": self.page_count,
            "title": self.title,
            "doc_category": self.doc_category,
            "description": self.description,
        }


def detect_doc_type_from_pdf(file_path: str | Path) -> DetectionResult:
    """Detect X12 document type and metadata from PDF content.
    
    Args:
        file_path: Path to the PDF file
        
    Returns:
        DetectionResult with detected metadata (fields may be None)
    """
    import fitz  # PyMuPDF
    
    file_path = Path(file_path)
    result = DetectionResult()
    
    if not file_path.exists():
        logger.warning(f"PDF file not found: {file_path}")
        return result
    
    try:
        doc = fitz.open(str(file_path))
        result.page_count = len(doc)
        
        # Extract PDF metadata
        pdf_meta = doc.metadata
        
        # Extract text from first 3 pages for analysis
        text_content = ""
        first_page_text = ""
        pages_to_check = min(3, len(doc))
        for i in range(pages_to_check):
            page_text = doc[i].get_text()[:5000]
            if i == 0:
                first_page_text = page_text
            text_content += page_text + "\n"
        
        # Extract title from first page content (not PDF metadata - often garbage)
        result.title = _extract_title_from_content(first_page_text)
        
        text_lower = text_content.lower()
        
        # Try to extract X12 version
        result.x12_version = _extract_x12_version(pdf_meta, text_content)
        
        # Detect doc_type from X12 version (highest confidence)
        if result.x12_version:
            version_code = _extract_version_code(result.x12_version)
            if version_code and version_code in X12_VERSION_MAP:
                mapping = X12_VERSION_MAP[version_code]
                result.doc_type = mapping["doc_type"]
                result.doc_subtype = mapping.get("doc_subtype")
                result.confidence = "high"
                result.detection_source = "x12_version"
                logger.info(f"Detected doc_type={result.doc_type} from X12 version {result.x12_version}")
        
        # If no X12 version match, try content keywords (medium confidence)
        if not result.doc_type:
            for keyword, mapping in CONTENT_KEYWORDS.items():
                if keyword in text_lower:
                    result.doc_type = mapping["doc_type"]
                    result.doc_subtype = mapping.get("doc_subtype")
                    result.confidence = "medium"
                    result.detection_source = "content_keywords"
                    logger.info(f"Detected doc_type={result.doc_type} from keyword '{keyword}'")
                    break
        
        # Extract effective date
        result.effective_date = _extract_effective_date(pdf_meta, text_content)
        
        # Extract release/publication date (may differ from effective date)
        result.release_date = _extract_release_date(pdf_meta, text_content)
        
        # Extract source organization
        result.source_org = _extract_source_org(pdf_meta, text_content)
        
        # Detect document category (full_guide, addendum, errata)
        result.doc_category = _detect_doc_category(text_content)
        
        # Extract description from content if available
        result.description = _extract_description(text_content)
        
        doc.close()
        
    except Exception as e:
        logger.warning(f"Error detecting doc type from PDF: {e}")
    
    return result


def _extract_x12_version(pdf_meta: dict, text_content: str) -> str | None:
    """Extract X12 version string from PDF metadata or content.
    
    Returns version like '005010X222A1' or 'X220E2' or None.
    """
    # Patterns to match X12 versions
    # Full: 005010X222A1, 005010X223A3
    # Short: X224A2, X220E2
    full_pattern = r'00\d{4}X\d{3}[A-Z]?\d?'
    short_pattern = r'X\d{3}[A-Z]?\d?'
    
    # Check PDF metadata fields first
    for field in ['title', 'subject', 'keywords']:
        value = pdf_meta.get(field, '')
        if value:
            match = re.search(full_pattern, value)
            if match:
                return match.group()
            match = re.search(short_pattern, value)
            if match:
                return match.group()
    
    # Check content
    # Look for full version first
    match = re.search(full_pattern, text_content)
    if match:
        return match.group()
    
    # Look for short version
    match = re.search(short_pattern, text_content)
    if match:
        return match.group()
    
    return None


def _extract_version_code(x12_version: str) -> str | None:
    """Extract the Xnnn code from an X12 version string.
    
    Examples:
        '005010X222A1' -> 'X222'
        'X220E2' -> 'X220'
    """
    match = re.search(r'X(\d{3})', x12_version)
    if match:
        return f"X{match.group(1)}"
    return None


def _extract_effective_date(pdf_meta: dict, text_content: str) -> str | None:
    """Extract effective/publication date from PDF.
    
    Returns ISO date string (YYYY-MM-DD) or None.
    """
    from datetime import datetime
    
    # Try PDF creation/modification date
    for field in ['creationDate', 'modDate']:
        date_str = pdf_meta.get(field)
        if date_str:
            parsed = _parse_pdf_date(date_str)
            if parsed:
                return parsed
    
    # Try to find date in content
    # Common formats: "MAY 2006", "JUNE 2023", "January 2024"
    date_pattern = r'(January|February|March|April|May|June|July|August|September|October|November|December|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{4})'
    match = re.search(date_pattern, text_content, re.IGNORECASE)
    if match:
        month_str, year = match.groups()
        month_map = {
            'january': '01', 'february': '02', 'march': '03', 'april': '04',
            'may': '05', 'june': '06', 'july': '07', 'august': '08',
            'september': '09', 'october': '10', 'november': '11', 'december': '12',
            'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
            'jun': '06', 'jul': '07', 'aug': '08', 'sep': '09',
            'oct': '10', 'nov': '11', 'dec': '12'
        }
        month = month_map.get(month_str.lower(), '01')
        return f"{year}-{month}-01"
    
    return None


def _parse_pdf_date(date_str: str) -> str | None:
    """Parse PDF date format to ISO date string.
    
    PDF dates: D:YYYYMMDDHHmmSS±HH'mm' or D:YYYYMMDD
    Returns: YYYY-MM-DD or None
    """
    from datetime import datetime
    
    if not date_str:
        return None
    
    # Remove 'D:' prefix if present
    if date_str.startswith('D:'):
        date_str = date_str[2:]
    
    # Remove timezone info
    for tz_marker in ['+', '-', 'Z']:
        if tz_marker in date_str[8:]:
            date_str = date_str[:date_str.index(tz_marker, 8)]
            break
    
    try:
        if len(date_str) >= 14:
            dt = datetime.strptime(date_str[:14], '%Y%m%d%H%M%S')
            return dt.strftime('%Y-%m-%d')
        elif len(date_str) >= 8:
            dt = datetime.strptime(date_str[:8], '%Y%m%d')
            return dt.strftime('%Y-%m-%d')
    except ValueError:
        pass
    
    return None


def _extract_source_org(pdf_meta: dict, text_content: str) -> str | None:
    """Extract source organization from PDF metadata or content."""
    
    # Check PDF metadata
    author = pdf_meta.get('author', '')
    producer = pdf_meta.get('producer', '')
    combined = f"{author} {producer}".lower()
    
    org_patterns = [
        ('CAQH CORE', ['caqh core', 'caqh']),
        ('ASC X12', ['asc x12', 'x12.org']),
        ('Washington Publishing Company', ['washington publishing', 'wpc']),
    ]
    
    for org_name, patterns in org_patterns:
        for pattern in patterns:
            if pattern in combined:
                return org_name
    
    # Check content
    text_lower = text_content[:3000].lower()
    for org_name, patterns in org_patterns:
        for pattern in patterns:
            if pattern in text_lower:
                return org_name
    
    return None


def _extract_release_date(pdf_meta: dict, text_content: str) -> str | None:
    """Extract release/publication date from PDF.
    
    This may differ from effective_date (compliance date vs publication date).
    Returns ISO date string (YYYY-MM-DD) or None.
    """
    # Look for explicit "Released" or "Published" dates in content
    release_patterns = [
        r'Released[:\s]+(\w+\s+\d{1,2},?\s+\d{4})',
        r'Published[:\s]+(\w+\s+\d{1,2},?\s+\d{4})',
        r'Publication Date[:\s]+(\w+\s+\d{1,2},?\s+\d{4})',
        r'Release Date[:\s]+(\w+\s+\d{1,2},?\s+\d{4})',
    ]
    
    for pattern in release_patterns:
        match = re.search(pattern, text_content, re.IGNORECASE)
        if match:
            return _parse_natural_date(match.group(1))
    
    # Fall back to PDF modification date as release approximation
    mod_date = pdf_meta.get('modDate')
    if mod_date:
        parsed = _parse_pdf_date(mod_date)
        if parsed:
            return parsed
    
    return None


def _parse_natural_date(date_str: str) -> str | None:
    """Parse natural date like 'January 15, 2024' to ISO format."""
    from datetime import datetime
    
    formats = [
        '%B %d, %Y',  # January 15, 2024
        '%B %d %Y',   # January 15 2024
        '%b %d, %Y',  # Jan 15, 2024
        '%b %d %Y',   # Jan 15 2024
    ]
    
    date_str = date_str.strip().replace(',', ', ').replace('  ', ' ')
    
    for fmt in formats:
        try:
            dt = datetime.strptime(date_str.strip(), fmt)
            return dt.strftime('%Y-%m-%d')
        except ValueError:
            continue
    
    return None


def _detect_doc_category(text_content: str) -> str:
    """Detect document category from content.
    
    Returns: 'full_guide', 'addendum', or 'errata'
    """
    text_lower = text_content.lower()
    
    # Check for errata indicators
    errata_keywords = [
        'errata',
        'corrections to',
        'corrected version',
        'correction notice',
    ]
    for keyword in errata_keywords:
        if keyword in text_lower:
            return 'errata'
    
    # Check for addendum indicators
    addendum_keywords = [
        'addendum',
        'supplement',
        'appendix',
        'companion guide',
        'supplemental',
    ]
    for keyword in addendum_keywords:
        if keyword in text_lower:
            return 'addendum'
    
    # Default to full guide
    return 'full_guide'


def _extract_description(text_content: str) -> str | None:
    """Extract a brief description from the document content.
    
    Looks for abstract, overview, or first meaningful paragraph.
    """
    # Try to find an explicit purpose or abstract section
    abstract_patterns = [
        r'(?:Abstract|Purpose|Overview)[:\s]*([^\n]{50,300})',
        r'This (?:guide|document|implementation)[^\n]{20,250}',
    ]
    
    for pattern in abstract_patterns:
        match = re.search(pattern, text_content, re.IGNORECASE)
        if match:
            desc = match.group(1) if '(' in pattern else match.group(0)
            # Clean up
            desc = re.sub(r'\s+', ' ', desc).strip()
            if len(desc) > 50:
                return desc[:300] + '...' if len(desc) > 300 else desc
    
    return None


def _extract_title_from_content(first_page_text: str) -> str | None:
    """Extract document title from first page content.
    
    Looks for X12 implementation guide title patterns.
    """
    # For X12 docs, title often spans multiple lines on cover page
    # Look for transaction name pattern like "Benefit Enrollment and Maintenance (834)"
    
    # First, try to find a line with transaction number in parens
    # Normalize whitespace first to handle multi-line titles
    normalized_text = re.sub(r'\s+', ' ', first_page_text[:1000])
    
    match = re.search(r'([A-Za-z][A-Za-z\s]+)\s*\((\d{3})\)', normalized_text)
    if match:
        tx_name = match.group(1).strip()
        tx_code = match.group(2)
        # Look for "Technical Report Type 3" or "Implementation Guide" nearby
        if 'Technical Report Type 3' in first_page_text:
            return f"{tx_name} ({tx_code}) - Technical Report Type 3"
        elif 'Implementation Guide' in first_page_text:
            return f"{tx_name} ({tx_code}) - Implementation Guide"
        return f"{tx_name} ({tx_code})"
    
    lines = first_page_text.strip().split('\n')
    
    # Filter to non-empty lines with meaningful content
    candidate_lines = []
    for line in lines[:30]:  # Check first 30 lines
        line = line.strip()
        # Skip short lines, page numbers, dates, etc.
        if len(line) < 10:
            continue
        if re.match(r'^[\d\s/\-\.]+$', line):  # Just numbers/dates
            continue
        if re.match(r'^(Page|Version|Draft|Copyright|Based on)', line, re.IGNORECASE):
            continue
        if re.match(r'^[A-Z]{3,}\s+\d{4}$', line):  # "JUNE 2014"
            continue
        candidate_lines.append(line)
    
    # Look for X12 implementation guide patterns
    for line in candidate_lines:
        # Match patterns like "834 Benefit Enrollment" or "Health Care Claim Payment/Advice"
        if re.search(r'(Implementation Guide|Technical Report)', line, re.IGNORECASE):
            # Clean up and return
            title = re.sub(r'\s+', ' ', line).strip()
            return title[:200] if len(title) > 200 else title
        
        # Match X12 transaction descriptions
        if re.search(r'\b(8\d{2}|27[0-9]|999)\b.*\b(Claim|Enrollment|Eligibility|Payment|Remittance|Authorization)', line, re.IGNORECASE):
            title = re.sub(r'\s+', ' ', line).strip()
            return title[:200] if len(title) > 200 else title
    
    # Fall back to first substantial line (likely the title)
    for line in candidate_lines:
        if len(line) >= 20:  # Substantial enough to be a title
            title = re.sub(r'\s+', ' ', line).strip()
            return title[:200] if len(title) > 200 else title
    
    return None
    
    return None
