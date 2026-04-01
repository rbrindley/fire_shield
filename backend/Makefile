.PHONY: install lock dev

# Install from lockfile with hash verification
install:
	pip install --no-deps --require-hashes -r requirements.lock

# Regenerate lockfile from pyproject.toml
lock:
	pip-compile pyproject.toml -o requirements.lock --generate-hashes --no-emit-index-url

# Install dev dependencies (not hash-pinned)
dev:
	pip install -e ".[dev]"
