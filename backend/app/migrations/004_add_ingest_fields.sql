-- Add fields needed by ingest pipeline and admin routes

-- ingested_at column on documents
ALTER TABLE documents ADD COLUMN ingested_at TEXT;

-- chunk_count to track indexing progress
ALTER TABLE documents ADD COLUMN chunk_count INTEGER DEFAULT 0;

-- error_message for failed ingestions
ALTER TABLE corpus_sources ADD COLUMN error_message TEXT;
