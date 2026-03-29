"""X12 Guide Assistant - Main Application Package."""

# Load .env FIRST before any other imports
# This ensures HF_HOME, SENTENCE_TRANSFORMERS_HOME etc. are set
# before sentence-transformers/transformers check cache locations
import os
from pathlib import Path

_env_file = Path(__file__).parent.parent / ".env"
if _env_file.exists():
    with open(_env_file) as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith('#') and '=' in _line:
                _key, _, _value = _line.partition('=')
                if _key not in os.environ:
                    os.environ[_key] = _value

