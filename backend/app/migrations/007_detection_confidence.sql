-- Migration 007: Add doc_type_confidence column
-- Tracks how the doc_type was determined: 'high', 'medium', 'low', 'manual', or NULL

ALTER TABLE documents ADD COLUMN doc_type_confidence TEXT;
