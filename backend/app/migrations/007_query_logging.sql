-- Migration 007: Add query/response logging to query_traces
-- =============================================================================
-- Stores the actual question and response text for debugging and analysis

ALTER TABLE query_traces ADD COLUMN question TEXT;
ALTER TABLE query_traces ADD COLUMN response TEXT;

-- Index for searching questions (useful for debugging similar queries)
CREATE INDEX IF NOT EXISTS idx_query_traces_question ON query_traces(question);
