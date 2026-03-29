FROM python:3.11-slim

WORKDIR /app

# Install system deps for PDF extraction and geospatial
RUN apt-get update && apt-get install -y --no-install-recommends \
    libmupdf-dev \
    libgdal-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY pyproject.toml .
RUN pip install --no-cache-dir -e .

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
