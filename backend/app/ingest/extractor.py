"""PDF extraction using Marker (vision-based).

Marker is the PRIMARY extractor for all PDFs, especially X12 guides with tables.
PyMuPDF/FallbackExtractor is ONLY for plain text documents (txt, md, etc.)
since it completely destroys table structure.

CITATION ACCURACY - PER-PAGE EXTRACTION:
    We extract ONE PAGE AT A TIME rather than the whole PDF at once.
    
    Why? Marker merges content from multiple pages into a single markdown output,
    losing page boundaries. This breaks citations like "see page 47, section 2000A"
    because we can't determine which page content came from.
    
    By extracting each page individually:
    - Page 1 content → tagged as page_number=1
    - Page 2 content → tagged as page_number=2
    - etc.
    
    This enables accurate citations in RAG responses: "See page 47, Loop 2000A"
    
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

# GPU Optimization for RTX 3050 (4GB VRAM):
# - Use small batch sizes to fit in VRAM
# - Models use ~3.25GB, leaving ~400MB for inference
# - Batch size of 2 keeps memory under control
# Set these BEFORE importing torch/marker
GPU_BATCH_SIZE = "2"  # Small batch for 4GB VRAM
os.environ["LAYOUT_BATCH_SIZE"] = GPU_BATCH_SIZE
os.environ["DETECTOR_BATCH_SIZE"] = GPU_BATCH_SIZE
os.environ["TABLE_REC_BATCH_SIZE"] = GPU_BATCH_SIZE
os.environ["OCR_ERROR_BATCH_SIZE"] = GPU_BATCH_SIZE
os.environ["RECOGNITION_BATCH_SIZE"] = GPU_BATCH_SIZE

# CPU Optimization: Use all available threads
os.environ["OMP_NUM_THREADS"] = "20"  # Use all 20 threads on i7-12700H
os.environ["MKL_NUM_THREADS"] = "20"
os.environ["DETECTOR_POSTPROCESSING_CPU_WORKERS"] = "20"  # Max postprocessing workers (RAM allows)


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
    Marker preserves table structure which is critical for X12 guides.
    
    GPU Mode (RTX 3050 4GB): Uses small batch sizes (2) to fit in VRAM.
    ~3-5x faster than CPU mode.
    
    Falls back to CPU if GPU OOM occurs.
    """

    def __init__(self, force_cpu: bool = False):
        self.models = None
        self.force_cpu = force_cpu
        self._using_gpu = False

    def _ensure_models_loaded(self):
        """Lazy load Marker models.
        
        Local extraction ALWAYS uses CPU mode (force_cpu=True by default).
        This avoids CUDA OOM errors on systems with limited GPU VRAM.
        Cloud providers (Modal, RunPod, etc.) handle GPU-accelerated extraction.
        """
        if self.models is None:
            import torch
            
            MIN_VRAM_GB = 3.5  # Models need ~3.25GB, require 3.5GB free
            
            if self.force_cpu:
                logger.info("Loading Marker models on CPU (local extraction always uses CPU)...")
                os.environ["TORCH_DEVICE"] = "cpu"
                torch.cuda.is_available = lambda: False
                self._using_gpu = False
            else:
                use_gpu = False
                if torch.cuda.is_available():
                    # Check if we have enough FREE VRAM (not just total)
                    torch.cuda.empty_cache()
                    total_mem = torch.cuda.get_device_properties(0).total_memory / 1024**3
                    allocated = torch.cuda.memory_allocated() / 1024**3
                    reserved = torch.cuda.memory_reserved() / 1024**3
                    free_mem = total_mem - max(allocated, reserved)
                    
                    logger.info(
                        f"GPU: {torch.cuda.get_device_name(0)} - "
                        f"Total: {total_mem:.2f}GB, Free: {free_mem:.2f}GB, "
                        f"Allocated: {allocated:.2f}GB, Reserved: {reserved:.2f}GB"
                    )
                    
                    if free_mem >= MIN_VRAM_GB:
                        logger.info(f"Sufficient VRAM available ({free_mem:.2f}GB >= {MIN_VRAM_GB}GB)")
                        use_gpu = True
                    else:
                        logger.warning(
                            f"Insufficient VRAM ({free_mem:.2f}GB < {MIN_VRAM_GB}GB needed). "
                            "Using CPU instead."
                        )
                        os.environ["TORCH_DEVICE"] = "cpu"
                else:
                    logger.info("No GPU available, using CPU...")
                    os.environ["TORCH_DEVICE"] = "cpu"
                    
                if use_gpu:
                    self._using_gpu = True
            
            # Try loading models, with GPU fallback to CPU on OOM
            try:
                from marker.models import create_model_dict
                self.models = create_model_dict()
            except (RuntimeError, torch.cuda.OutOfMemoryError) as e:
                if self._using_gpu and ("CUDA" in str(e) or "out of memory" in str(e).lower()):
                    logger.warning(f"GPU OOM during model load: {e}")
                    logger.info("Falling back to CPU for model loading...")
                    torch.cuda.empty_cache()
                    os.environ["TORCH_DEVICE"] = "cpu"
                    self._using_gpu = False
                    self.models = None
                    from marker.models import create_model_dict
                    self.models = create_model_dict()
                else:
                    raise
            
            if self._using_gpu:
                mem_used = torch.cuda.memory_allocated() / 1024**3
                logger.info(f"Marker models loaded on GPU ({mem_used:.2f}GB used)")
            else:
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
            config={
                "batch_multiplier": settings.marker_batch_multiplier,
                "force_ocr": settings.marker_force_ocr,
            },
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
                # Try extraction, with OOM fallback to CPU
                try:
                    device = "GPU" if self._using_gpu else "CPU"
                    logger.info(f"[EXTRACT] Page {page_num}/{total_pages} starting [{device}]...")
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
                except (RuntimeError, Exception) as e:
                    import torch
                    error_str = str(e).lower()
                    is_oom = (
                        isinstance(e, torch.cuda.OutOfMemoryError) or
                        "cuda" in error_str and "out of memory" in error_str or
                        "cuda out of memory" in error_str
                    )
                    
                    if self._using_gpu and is_oom:
                        logger.warning(f"GPU OOM on page {page_num}: {e}")
                        logger.info("Falling back to CPU for remaining extraction...")
                        
                        # Clear GPU memory and switch to CPU
                        torch.cuda.empty_cache()
                        os.environ["TORCH_DEVICE"] = "cpu"
                        self._using_gpu = False
                        
                        # Reload models on CPU
                        self.models = None
                        self._ensure_models_loaded()
                        
                        # Recreate converter with CPU models
                        converter = PdfConverter(
                            artifact_dict=self.models,
                            config={
                                "batch_multiplier": settings.marker_batch_multiplier,
                                "force_ocr": settings.marker_force_ocr,
                            },
                        )
                        
                        # Retry this page on CPU
                        logger.info(f"Retrying page {page_num} on CPU...")
                        result = converter(temp_path)
                    else:
                        raise
                
                content = result.markdown if hasattr(result, "markdown") else str(result)
                
                pages.append({
                    "page_number": page_num,
                    "content": content.strip(),
                    "has_table": "|" in content and "---" in content,
                })
                
                if page_num % 10 == 0 or page_num == total_pages:
                    device = "GPU" if self._using_gpu else "CPU"
                    logger.info(f"Extracted page {page_num}/{total_pages} [{device}]")
                    
            finally:
                import os
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
    for X12 implementation guides or any PDF with tables.
    
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
    """Get or create PDF extractor (Marker-based).
    
    Always uses CPU mode for local extraction to avoid CUDA OOM errors
    on systems with limited GPU VRAM. Cloud extraction handles GPU processing.
    """
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
