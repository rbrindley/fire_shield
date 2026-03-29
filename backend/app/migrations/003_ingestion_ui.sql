-- Migration 003: Enhanced Ingestion Tracking for Admin UI
-- Adds columns needed for real-time progress tracking and provider selection

-- Add new columns to ingestion_traces for enhanced tracking
ALTER TABLE ingestion_traces ADD COLUMN current_step TEXT;
ALTER TABLE ingestion_traces ADD COLUMN pages_processed INTEGER DEFAULT 0;
ALTER TABLE ingestion_traces ADD COLUMN extraction_mode TEXT;  -- 'auto', 'local', 'cloud'
ALTER TABLE ingestion_traces ADD COLUMN provider TEXT;         -- 'runpod', 'vastai', or NULL
ALTER TABLE ingestion_traces ADD COLUMN gpu_type TEXT;
ALTER TABLE ingestion_traces ADD COLUMN no_failover INTEGER DEFAULT 0;
ALTER TABLE ingestion_traces ADD COLUMN started_at TEXT;
ALTER TABLE ingestion_traces ADD COLUMN completed_at TEXT;

-- Create index for faster status queries
CREATE INDEX IF NOT EXISTS idx_ingestion_traces_status ON ingestion_traces(status, started_at DESC);

-- Create index for active ingestions lookup
CREATE INDEX IF NOT EXISTS idx_ingestion_traces_active ON ingestion_traces(status) WHERE status IN ('queued', 'processing');
