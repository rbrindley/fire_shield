"""Dynamic GPU/CPU embedding with BGE-large."""

import logging
import os
from pathlib import Path

from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


def _resolve_model_path(model_name: str) -> str:
    """Resolve a HuggingFace model name to local cache path if available."""
    hf_home = os.environ.get("HF_HOME", os.path.expanduser("~/.cache/huggingface"))
    cache_dir = Path(hf_home) / "hub" / f"models--{model_name.replace('/', '--')}" / "snapshots"

    if cache_dir.exists():
        snapshots = list(cache_dir.iterdir())
        if snapshots:
            return str(sorted(snapshots)[-1])

    return model_name


class DynamicEmbedder:
    """Embedding model with dynamic GPU/CPU selection."""

    def __init__(self):
        self.model_name = settings.embedding_model
        self.model_path = _resolve_model_path(self.model_name)
        self.device_config = settings.embedding_device
        self.vram_threshold_mb = settings.vram_threshold_mb
        self.model = None
        self.current_device: str | None = None

    def _get_free_vram_mb(self) -> float:
        try:
            import torch
            if not torch.cuda.is_available():
                return 0
            free, _ = torch.cuda.mem_get_info()
            return free / (1024 * 1024)
        except Exception:
            return 0

    def _select_device(self) -> str:
        if self.device_config == "cpu":
            return "cpu"
        if self.device_config == "cuda":
            return "cuda"
        # Auto mode
        if self._get_free_vram_mb() >= self.vram_threshold_mb:
            return "cuda"
        return "cpu"

    def _ensure_model(self, device: str):
        if self.model is None or self.current_device != device:
            if self.current_device and self.current_device != device:
                logger.info("Embedding device switch: %s → %s", self.current_device, device)
            from sentence_transformers import SentenceTransformer
            self.model = SentenceTransformer(self.model_path, device=device)
            self.current_device = device

    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for a list of texts."""
        device = self._select_device()
        self._ensure_model(device)

        try:
            embeddings = self.model.encode(
                texts,
                convert_to_numpy=True,
                batch_size=settings.embedding_batch_size,
            )
            return embeddings.tolist()
        except Exception:
            # Fallback to CPU
            if device != "cpu":
                logger.warning("Embedding failed on %s, falling back to CPU", device)
                self._ensure_model("cpu")
                embeddings = self.model.encode(
                    texts,
                    convert_to_numpy=True,
                    batch_size=settings.embedding_batch_size,
                )
                return embeddings.tolist()
            raise


_embedder: DynamicEmbedder | None = None


def get_embedder() -> DynamicEmbedder:
    """Get or create embedder instance."""
    global _embedder
    if _embedder is None:
        _embedder = DynamicEmbedder()
    return _embedder
