"""Chunk validation for PDF extraction quality assurance.

Validates extracted chunks in real-time during extraction, allowing
early detection of issues and intelligent retry/halt decisions.

Runs on CPU asynchronously while GPU processes the next chunk.
"""

import logging
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

logger = logging.getLogger(__name__)


class ValidationSeverity(Enum):
    """Severity levels for validation issues."""
    INFO = "info"           # Minor observation
    WARNING = "warning"     # Potential issue, but extraction usable
    ERROR = "error"         # Significant problem, chunk may need retry
    CRITICAL = "critical"   # Severe issue, likely corrupted extraction


@dataclass
class ValidationIssue:
    """A single validation issue found in a chunk."""
    severity: ValidationSeverity
    code: str
    message: str
    page_number: Optional[int] = None
    details: Optional[dict] = None


@dataclass 
class ChunkValidationResult:
    """Result of validating an extracted chunk."""
    chunk_start_page: int
    chunk_end_page: int
    pages_extracted: int
    total_chars: int
    chars_per_page: float
    tables_detected: int
    issues: list[ValidationIssue] = field(default_factory=list)
    passed: bool = True
    
    @property
    def has_errors(self) -> bool:
        return any(i.severity in (ValidationSeverity.ERROR, ValidationSeverity.CRITICAL) 
                   for i in self.issues)
    
    @property
    def error_count(self) -> int:
        return sum(1 for i in self.issues 
                   if i.severity in (ValidationSeverity.ERROR, ValidationSeverity.CRITICAL))


@dataclass
class ExtractionValidationState:
    """Tracks validation state across all chunks for halt decisions."""
    
    total_chunks: int = 0
    validated_chunks: int = 0
    passed_chunks: int = 0
    failed_chunks: int = 0
    consecutive_failures: int = 0
    recent_results: list[bool] = field(default_factory=list)  # Last 10 results
    chunk_results: list[ChunkValidationResult] = field(default_factory=list)
    halted: bool = False
    halt_reason: Optional[str] = None
    
    # Halt thresholds
    MAX_CONSECUTIVE_FAILURES = 3
    MAX_FAILURES_IN_WINDOW = 6
    WINDOW_SIZE = 10
    
    def record_result(self, result: ChunkValidationResult) -> bool:
        """Record a validation result and check if extraction should halt.
        
        Returns:
            True if extraction should continue, False if it should halt.
        """
        self.validated_chunks += 1
        self.chunk_results.append(result)
        
        if result.has_errors:
            self.failed_chunks += 1
            self.consecutive_failures += 1
            self.recent_results.append(False)
        else:
            self.passed_chunks += 1
            self.consecutive_failures = 0
            self.recent_results.append(True)
        
        # Keep only last N results
        if len(self.recent_results) > self.WINDOW_SIZE:
            self.recent_results.pop(0)
        
        # Check halt conditions
        if self.consecutive_failures >= self.MAX_CONSECUTIVE_FAILURES:
            self.halted = True
            self.halt_reason = (
                f"Halted: {self.consecutive_failures} consecutive chunk failures. "
                f"Last failed chunk: pages {result.chunk_start_page}-{result.chunk_end_page}"
            )
            logger.error(self.halt_reason)
            return False
        
        # Check rolling window (only if we have enough data)
        if len(self.recent_results) >= self.WINDOW_SIZE:
            failures_in_window = self.recent_results.count(False)
            if failures_in_window >= self.MAX_FAILURES_IN_WINDOW:
                self.halted = True
                self.halt_reason = (
                    f"Halted: {failures_in_window}/{self.WINDOW_SIZE} chunks failed "
                    f"in recent window. Too many extraction issues."
                )
                logger.error(self.halt_reason)
                return False
        
        return True
    
    def get_failed_chunks(self) -> list[ChunkValidationResult]:
        """Get all chunks that failed validation."""
        return [r for r in self.chunk_results if r.has_errors]
    
    def get_summary(self) -> dict:
        """Get validation summary."""
        return {
            "total_chunks": self.total_chunks,
            "validated_chunks": self.validated_chunks,
            "passed_chunks": self.passed_chunks,
            "failed_chunks": self.failed_chunks,
            "pass_rate": (self.passed_chunks / self.validated_chunks * 100) if self.validated_chunks else 0,
            "halted": self.halted,
            "halt_reason": self.halt_reason,
        }


class ChunkValidator:
    """Validates extracted page chunks for quality issues.
    
    Validation checks:
    1. Content present (not empty pages)
    2. Reasonable character count per page
    3. Table detection for X12 guides
    4. Error markers in content
    5. Expected content patterns
    """
    
    # Expected chars per page for X12 implementation guides
    # These are dense technical documents with tables
    MIN_CHARS_PER_PAGE = 200    # Very sparse page
    WARN_CHARS_PER_PAGE = 400   # Suspiciously low
    MAX_CHARS_PER_PAGE = 5000   # Very dense (possible OCR noise)
    
    # Error patterns that indicate extraction problems
    ERROR_PATTERNS = [
        r'\[ERROR\]',
        r'\[EXTRACTION_FAILED\]', 
        r'<ERROR>',
        r'OCR\s+failed',
        r'Unable\s+to\s+extract',
    ]
    
    # X12-specific patterns we expect to find
    X12_PATTERNS = [
        r'\b(LOOP|Loop)\s*[:\-]?\s*(2\d{3}[A-Z]?)',  # Loop references like 2000A, 2100B
        r'\b(ISA|GS|ST|SE|GE|IEA)\b',                 # X12 envelope segments
        r'\b(NM1|N3|N4|DMG|REF|DTP)\b',              # Common X12 segments
        r'\b(M|O|C|X)\s*$',                           # Usage indicators in tables
        r'Segment:?\s+[A-Z]{2,3}',                   # Segment references
    ]
    
    def __init__(self):
        self._error_patterns = [re.compile(p, re.IGNORECASE) for p in self.ERROR_PATTERNS]
        self._x12_patterns = [re.compile(p) for p in self.X12_PATTERNS]
    
    async def validate_chunk(
        self,
        pages: list[dict],
        chunk_start_page: int,
        chunk_end_page: int,
        is_x12_guide: bool = True,
    ) -> ChunkValidationResult:
        """Validate an extracted chunk of pages.
        
        Args:
            pages: List of extracted page dicts with 'content', 'page_number', 'has_table'
            chunk_start_page: Starting page number (1-indexed)
            chunk_end_page: Ending page number (1-indexed, inclusive)
            is_x12_guide: Whether to check for X12-specific content
            
        Returns:
            ChunkValidationResult with issues found
        """
        result = ChunkValidationResult(
            chunk_start_page=chunk_start_page,
            chunk_end_page=chunk_end_page,
            pages_extracted=len(pages),
            total_chars=0,
            chars_per_page=0,
            tables_detected=0,
        )
        
        issues = []
        total_content = ""
        
        # Check expected vs actual page count
        expected_pages = chunk_end_page - chunk_start_page + 1
        if len(pages) != expected_pages:
            issues.append(ValidationIssue(
                severity=ValidationSeverity.ERROR,
                code="PAGE_COUNT_MISMATCH",
                message=f"Expected {expected_pages} pages, got {len(pages)}",
                details={"expected": expected_pages, "actual": len(pages)}
            ))
        
        # Validate each page
        empty_pages = []
        sparse_pages = []
        
        for page in pages:
            content = page.get("content", "")
            page_num = page.get("page_number", 0)
            total_content += content
            
            char_count = len(content.strip())
            
            # Check for empty pages
            if char_count < 50:
                empty_pages.append(page_num)
            elif char_count < self.MIN_CHARS_PER_PAGE:
                sparse_pages.append(page_num)
            
            # Check for error patterns
            for pattern in self._error_patterns:
                if pattern.search(content):
                    issues.append(ValidationIssue(
                        severity=ValidationSeverity.ERROR,
                        code="ERROR_MARKER_FOUND",
                        message=f"Error marker found in page {page_num}",
                        page_number=page_num,
                        details={"pattern": pattern.pattern}
                    ))
            
            # Count tables
            if page.get("has_table"):
                result.tables_detected += 1
        
        # Aggregate stats
        result.total_chars = len(total_content.strip())
        result.chars_per_page = result.total_chars / len(pages) if pages else 0
        
        # Report empty pages - ERROR if >50% of pages are empty, or if >2 absolute
        if empty_pages:
            empty_ratio = len(empty_pages) / len(pages) if pages else 1
            is_error = empty_ratio > 0.5 or len(empty_pages) > 2
            severity = ValidationSeverity.ERROR if is_error else ValidationSeverity.WARNING
            issues.append(ValidationIssue(
                severity=severity,
                code="EMPTY_PAGES",
                message=f"{len(empty_pages)} empty/near-empty pages: {empty_pages[:5]}{'...' if len(empty_pages) > 5 else ''}",
                details={"pages": empty_pages, "ratio": empty_ratio}
            ))
        
        # Report sparse pages
        if sparse_pages:
            issues.append(ValidationIssue(
                severity=ValidationSeverity.WARNING,
                code="SPARSE_PAGES",
                message=f"{len(sparse_pages)} sparse pages (< {self.MIN_CHARS_PER_PAGE} chars)",
                details={"pages": sparse_pages}
            ))
        
        # Check overall chars per page
        if result.chars_per_page < self.WARN_CHARS_PER_PAGE and len(pages) > 1:
            issues.append(ValidationIssue(
                severity=ValidationSeverity.WARNING,
                code="LOW_CHAR_DENSITY",
                message=f"Low character density: {result.chars_per_page:.0f} chars/page",
                details={"chars_per_page": result.chars_per_page}
            ))
        
        if result.chars_per_page > self.MAX_CHARS_PER_PAGE:
            issues.append(ValidationIssue(
                severity=ValidationSeverity.WARNING,
                code="HIGH_CHAR_DENSITY",
                message=f"High character density: {result.chars_per_page:.0f} chars/page (possible OCR artifacts)",
                details={"chars_per_page": result.chars_per_page}
            ))
        
        # X12-specific validation
        if is_x12_guide and len(pages) >= 5:
            x12_matches = sum(1 for p in self._x12_patterns if p.search(total_content))
            if x12_matches == 0:
                issues.append(ValidationIssue(
                    severity=ValidationSeverity.WARNING,
                    code="NO_X12_PATTERNS",
                    message="No X12 patterns detected in chunk (may be intro/appendix section)",
                ))
            
            # Expect tables in X12 guides
            if result.tables_detected == 0 and len(pages) >= 10:
                issues.append(ValidationIssue(
                    severity=ValidationSeverity.WARNING,
                    code="NO_TABLES_DETECTED",
                    message="No tables detected in X12 chunk (X12 guides are table-heavy)",
                ))
        
        # Determine pass/fail
        result.issues = issues
        result.passed = not result.has_errors
        
        # Log result
        if result.has_errors:
            logger.warning(
                f"Chunk validation FAILED: pages {chunk_start_page}-{chunk_end_page}, "
                f"{result.error_count} errors, {len(issues)} total issues"
            )
        else:
            logger.info(
                f"Chunk validation passed: pages {chunk_start_page}-{chunk_end_page}, "
                f"{result.chars_per_page:.0f} chars/page, {result.tables_detected} tables"
            )
        
        return result


@dataclass
class FullExtractionValidationResult:
    """Result of validating the complete extraction."""
    total_pages_expected: int
    total_pages_extracted: int
    missing_pages: list[int]
    failed_chunks: list[ChunkValidationResult]
    retry_needed: bool
    chunks_to_retry: list[tuple[int, int]]  # List of (start, end) page ranges
    validation_passed: bool
    summary: str
    
    
async def validate_full_extraction(
    all_pages: list[dict],
    total_expected_pages: int,
    validation_state: ExtractionValidationState,
) -> FullExtractionValidationResult:
    """Validate the complete extraction after all chunks are processed.
    
    Checks:
    1. All pages were extracted
    2. No gaps in page numbers
    3. Failed chunks are identified for retry
    
    Args:
        all_pages: All extracted pages
        total_expected_pages: Expected total page count from PDF
        validation_state: State tracking from chunk validation
        
    Returns:
        FullExtractionValidationResult with retry recommendations
    """
    result = FullExtractionValidationResult(
        total_pages_expected=total_expected_pages,
        total_pages_extracted=len(all_pages),
        missing_pages=[],
        failed_chunks=validation_state.get_failed_chunks(),
        retry_needed=False,
        chunks_to_retry=[],
        validation_passed=True,
        summary="",
    )
    
    # Check for missing pages
    extracted_page_nums = {p.get("page_number") for p in all_pages}
    expected_page_nums = set(range(1, total_expected_pages + 1))
    result.missing_pages = sorted(expected_page_nums - extracted_page_nums)
    
    # Build retry list from failed chunks and missing pages
    chunks_to_retry = set()
    
    # Add failed chunks
    for failed in result.failed_chunks:
        chunks_to_retry.add((failed.chunk_start_page, failed.chunk_end_page))
    
    # Add chunks containing missing pages (group into ranges)
    if result.missing_pages:
        # Group consecutive missing pages
        ranges = []
        start = result.missing_pages[0]
        end = start
        
        for page in result.missing_pages[1:]:
            if page == end + 1:
                end = page
            else:
                ranges.append((start, end))
                start = page
                end = page
        ranges.append((start, end))
        
        for start, end in ranges:
            chunks_to_retry.add((start, end))
    
    result.chunks_to_retry = sorted(chunks_to_retry)
    result.retry_needed = len(result.chunks_to_retry) > 0
    
    # Determine overall pass/fail
    if result.missing_pages:
        result.validation_passed = False
    elif len(result.failed_chunks) > len(validation_state.chunk_results) * 0.1:  # >10% failed
        result.validation_passed = False
    
    # Build summary
    if result.validation_passed:
        result.summary = (
            f"✅ Extraction complete: {result.total_pages_extracted}/{result.total_pages_expected} pages, "
            f"{validation_state.passed_chunks}/{validation_state.validated_chunks} chunks passed validation"
        )
    else:
        issues = []
        if result.missing_pages:
            issues.append(f"{len(result.missing_pages)} missing pages")
        if result.failed_chunks:
            issues.append(f"{len(result.failed_chunks)} failed chunks")
        result.summary = (
            f"⚠️ Extraction issues: {', '.join(issues)}. "
            f"{len(result.chunks_to_retry)} chunk(s) need retry."
        )
    
    logger.info(result.summary)
    return result


# Global validator instance
_validator: ChunkValidator | None = None


def get_chunk_validator() -> ChunkValidator:
    """Get or create the chunk validator instance."""
    global _validator
    if _validator is None:
        _validator = ChunkValidator()
    return _validator
