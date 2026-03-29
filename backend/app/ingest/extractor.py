"""PDF extraction using Marker (vision-based).

Marker is the PRIMARY extractor for all PDFs, especially those with tables.
PyMuPDF/FallbackExtractor is ONLY for plain text documents (txt, md, etc.)
since it completely destroys table structure.

CITATION ACCURACY - PER-PAGE EXTRACTION:
    We extract ONE PAGE AT A TIME rather than the whole PDF at once.

    Why? Marker merges content from multiple pages into a single markdown output,
    losing page boundaries. This breaks citations like "see page 47, section 3.2"
    because we can't determine which page content came from.

    By extracting each page individually:
    - Page 1 content -> tagged as page_number=1
    - Page 2 content -> tagged as page_number=2
    - etc.

    This enables accurate citations in RAG responses: "See page 47, Section 3.2"

    Trade-off: Slower extraction (~10s/page vs ~2s/page batch), but citation
    accuracy is essential for a compliance reference system.
"""

import logging
import os
import threading
import time
from pathlib import Path

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Force CPU mode — Marker models load on CPU for local extraction.
os.environ["TORCH_DEVICE"] = "cpu"


class ExtractionHeartbeat:
    """Heartbeat logger for long-running extraction operations.

    Logs periodic messages to show that extraction is still running,
    useful for debugging hangs in Marker's internal processing.
    """

    def __init__(self, page_num: int, total_pages: int, interval: float = 30.0):
        self.page_num = page_num
        self.total_pages = total_pages
        self.interval = interval
        self._stop_event = threading.Event()
        self._thread = None
        self._start_time = None

    def _heartbeat_loop(self):
        """Background thread that logs heartbeat messages."""
        while not self._stop_event.wait(self.interval):
            elapsed = time.time() - self._start_time
            logger.info(
                f"[HEARTBEAT] Page {self.page_num}/{self.total_pages} "
                f"still processing... ({elapsed:.0f}s elapsed)"
            )

    def start(self):
        """Start the heartbeat thread."""
        self._start_time = time.time()
        self._thread = threading.Thread(target=self._heartbeat_loop, daemon=True)
        self._thread.start()

    def stop(self):
        """Stop the heartbeat thread."""
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=1.0)


class PDFExtractor:
    """Vision-based PDF extraction using Marker.

    This is the PRIMARY and ONLY extractor for PDFs.
    Marker preserves table structure which is critical for fire code documents.

    Always runs in CPU mode for local extraction.
    """

    def __init__(self, force_cpu: bool = True):
        self.models = None
        self.force_cpu = force_cpu

    def _ensure_models_loaded(self):
        """Lazy load Marker models on CPU."""
        if self.models is None:
            logger.info("Loading Marker models on CPU...")
            os.environ["TORCH_DEVICE"] = "cpu"

            from marker.models import create_model_dict
            self.models = create_model_dict()

            logger.info("Marker models loaded on CPU")

    async def extract(self, pdf_path: str) -> list[dict]:
        """Extract content from PDF, preserving table structure.

        IMPORTANT: Extracts ONE PAGE AT A TIME to guarantee accurate page numbers.
        This ensures citations like "see page 47, section X" are accurate.
        """
        import fitz
        from marker.converters.pdf import PdfConverter
        import tempfile

        self._ensure_models_loaded()

        # Get total page count
        doc = fitz.open(pdf_path)
        total_pages = len(doc)
        doc.close()

        logger.info(f"Extracting PDF with Marker: {pdf_path} ({total_pages} pages)")

        # Create converter once, reuse for all pages
        converter = PdfConverter(
            artifact_dict=self.models,
        )

        pages = []

        # Extract ONE PAGE AT A TIME for accurate page numbers
        for page_idx in range(total_pages):
            page_num = page_idx + 1  # 1-indexed for citations

            # Create single-page PDF
            doc = fitz.open(pdf_path)
            single_page_doc = fitz.open()
            single_page_doc.insert_pdf(doc, from_page=page_idx, to_page=page_idx)

            temp_path = tempfile.mktemp(suffix=".pdf")
            single_page_doc.save(temp_path)
            single_page_doc.close()
            doc.close()

            try:
                logger.info(f"[EXTRACT] Page {page_num}/{total_pages} starting [CPU]...")
                start_time = time.time()

                # Start heartbeat for long-running pages
                heartbeat = ExtractionHeartbeat(page_num, total_pages, interval=30.0)
                heartbeat.start()

                try:
                    result = converter(temp_path)
                finally:
                    heartbeat.stop()

                elapsed = time.time() - start_time
                logger.info(f"[EXTRACT] Page {page_num}/{total_pages} completed in {elapsed:.1f}s")

                content = result.markdown if hasattr(result, "markdown") else str(result)

                pages.append({
                    "page_number": page_num,
                    "content": content.strip(),
                    "has_table": "|" in content and "---" in content,
                })

                if page_num % 10 == 0 or page_num == total_pages:
                    logger.info(f"Extracted page {page_num}/{total_pages} [CPU]")

            finally:
                if os.path.exists(temp_path):
                    os.unlink(temp_path)

        logger.info(f"Extraction complete: {len(pages)} pages")
        return pages

    def _parse_marker_output(self, result) -> list[dict]:
        """Parse Marker output into page-based structure."""
        pages = []

        # Marker returns markdown with page markers
        content = result.markdown if hasattr(result, "markdown") else str(result)

        # Split by page markers if present
        page_splits = content.split("\n---\n")

        for i, page_content in enumerate(page_splits):
            pages.append(
                {
                    "page_number": i + 1,
                    "content": page_content.strip(),
                    "has_table": "|" in page_content and "---" in page_content,
                }
            )

        return pages


class TextFileExtractor:
    """Extractor for plain text files ONLY.

    Use this for .txt, .md, and other plain text formats.
    DO NOT use for PDFs - PyMuPDF destroys table structure.
    """

    SUPPORTED_EXTENSIONS = {".txt", ".md", ".rst", ".csv"}

    async def extract(self, file_path: str) -> list[dict]:
        """Extract text from plain text files."""
        path = Path(file_path)

        if path.suffix.lower() not in self.SUPPORTED_EXTENSIONS:
            raise ValueError(
                f"TextFileExtractor only supports {self.SUPPORTED_EXTENSIONS}, "
                f"got {path.suffix}. Use PDFExtractor for PDFs."
            )

        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()

        return [
            {
                "page_number": 1,
                "content": content.strip(),
                "has_table": False,
            }
        ]


class FallbackExtractor:
    """DEPRECATED: PyMuPDF-based extraction.

    WARNING: This extractor destroys table structure and should NOT be used
    for fire code PDFs or any PDF with tables.

    Only kept as emergency fallback if Marker fails completely.
    """

    async def extract(self, pdf_path: str) -> list[dict]:
        """Extract text from PDF using PyMuPDF.

        WARNING: Tables will be mangled. Use PDFExtractor instead.
        """
        import fitz  # PyMuPDF

        logger.warning(
            f"Using FallbackExtractor (PyMuPDF) for {pdf_path}. "
            "Table structure WILL be lost. Consider using PDFExtractor instead."
        )

        doc = fitz.open(pdf_path)
        pages = []

        for page_num, page in enumerate(doc):
            text = page.get_text()
            pages.append(
                {
                    "page_number": page_num + 1,
                    "content": text.strip(),
                    "has_table": False,  # PyMuPDF destroys tables
                }
            )

        doc.close()
        return pages


# Global extractor instance
_extractor: PDFExtractor | None = None
_text_extractor: TextFileExtractor | None = None


def get_extractor() -> PDFExtractor:
    """Get or create PDF extractor (Marker-based, CPU mode)."""
    global _extractor
    if _extractor is None:
        _extractor = PDFExtractor(force_cpu=True)
    return _extractor


def get_text_extractor() -> TextFileExtractor:
    """Get or create text file extractor for plain text files."""
    global _text_extractor
    if _text_extractor is None:
        _text_extractor = TextFileExtractor()
    return _text_extractor


def get_extractor_for_file(file_path: str) -> PDFExtractor | TextFileExtractor:
    """Get appropriate extractor based on file type.

    - PDFs: Always use Marker (PDFExtractor)
    - Text files: Use TextFileExtractor
    """
    path = Path(file_path)
    ext = path.suffix.lower()

    if ext == ".pdf":
        return get_extractor()
    elif ext in TextFileExtractor.SUPPORTED_EXTENSIONS:
        return get_text_extractor()
    else:
        # Default to PDF extractor for unknown types
        logger.warning(f"Unknown file type {ext}, defaulting to PDFExtractor")
        return get_extractor()
