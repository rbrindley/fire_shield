FROM python:3.11-slim

WORKDIR /app

# Install system deps for PDF extraction and geospatial
RUN apt-get update && apt-get install -y --no-install-recommends \
    libmupdf-dev \
    libgdal-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps from hash-pinned lockfile
COPY requirements.lock .
RUN pip install --no-cache-dir --no-deps --require-hashes -r requirements.lock

# Copy project metadata (needed for package to be importable)
COPY pyproject.toml .

# Copy app source
COPY app/ app/
COPY main.py .

# Create data dir (overridden by fly mount in production)
RUN mkdir -p /data

# Run migrations on startup via entrypoint wrapper
COPY scripts/start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 8100

CMD ["/start.sh"]
