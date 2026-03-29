-- Extraction Checkpoints for Resumable PDF Processing
-- Migration: 002_extraction_checkpoints.sql

-- =============================================================================
-- EXTRACTION CHECKPOINTS
-- =============================================================================
-- Tracks progress during long-running PDF extractions.
-- Allows resumption after interruption (power loss, crash, etc.)

CREATE TABLE IF NOT EXISTS extraction_checkpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_version_id INTEGER NOT NULL UNIQUE,
    last_completed_page INTEGER NOT NULL DEFAULT 0,
    total_pages INTEGER NOT NULL,
    extracted_pages_json TEXT,  -- JSON array of extracted page data
    status TEXT NOT NULL DEFAULT 'in_progress',  -- 'in_progress', 'completed', 'failed'
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (doc_version_id) REFERENCES document_versions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_status ON extraction_checkpoints(status);
CREATE INDEX IF NOT EXISTS idx_checkpoints_doc_version ON extraction_checkpoints(doc_version_id);

-- =============================================================================
-- NOTES
-- =============================================================================
-- 
-- extracted_pages_json stores the actual extracted content for each page:
-- [
--   {"page_number": 1, "content": "...", "has_table": true},
--   {"page_number": 2, "content": "...", "has_table": false},
--   ...
-- ]
--
-- Page numbers are ABSOLUTE (relative to full PDF), not relative to batch.
-- If processing pages 26-50 of a 600-page PDF, those pages are numbered 26-50,
-- not 1-25.
--
-- Batch size is configured in CheckpointExtractor (default: 25 pages).
-- After each batch completes:
--   1. extracted_pages_json is updated with new pages
--   2. last_completed_page is updated
--   3. Checkpoint is committed to DB
--
-- On resume:
--   1. Load existing checkpoint
--   2. Skip to last_completed_page
--   3. Continue extraction from next batch
