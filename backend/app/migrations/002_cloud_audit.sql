-- X12 Guide Assistant - Cloud Extraction Audit Schema
-- Migration: 002_cloud_audit.sql

-- =============================================================================
-- CLOUD EXTRACTION AUDIT
-- =============================================================================

-- Track all cloud GPU extraction operations for billing, debugging, and compliance
CREATE TABLE IF NOT EXISTS cloud_extraction_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_version_id INTEGER NOT NULL,
    user_id INTEGER,
    provider TEXT NOT NULL,  -- 'vastai', 'runpod', 'local_cpu'
    instance_count INTEGER DEFAULT 1,
    gpu_type TEXT,
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    status TEXT DEFAULT 'started',  -- 'started', 'success', 'failed', 'cancelled', 'timeout'
    pages_processed INTEGER,
    duration_seconds REAL,
    cost_usd REAL,
    error_message TEXT,
    -- Provider-specific metadata
    instance_id TEXT,  -- Provider's instance/pod ID
    region TEXT,
    metadata TEXT,  -- JSON for additional provider-specific data
    FOREIGN KEY (doc_version_id) REFERENCES document_versions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_cloud_audit_doc_version ON cloud_extraction_audit(doc_version_id);
CREATE INDEX IF NOT EXISTS idx_cloud_audit_user_id ON cloud_extraction_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_cloud_audit_started_at ON cloud_extraction_audit(started_at);
CREATE INDEX IF NOT EXISTS idx_cloud_audit_provider ON cloud_extraction_audit(provider);
CREATE INDEX IF NOT EXISTS idx_cloud_audit_status ON cloud_extraction_audit(status);

-- =============================================================================
-- COST TRACKING AGGREGATES (for quick monthly limit checks)
-- =============================================================================

-- View for monthly cost summary by provider
CREATE VIEW IF NOT EXISTS v_monthly_cloud_costs AS
SELECT 
    strftime('%Y-%m', started_at) as month,
    provider,
    COUNT(*) as extraction_count,
    SUM(pages_processed) as total_pages,
    SUM(cost_usd) as total_cost_usd,
    AVG(duration_seconds) as avg_duration_seconds,
    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count
FROM cloud_extraction_audit
GROUP BY strftime('%Y-%m', started_at), provider;

-- View for current month spend (for limit checks)
CREATE VIEW IF NOT EXISTS v_current_month_spend AS
SELECT 
    COALESCE(SUM(cost_usd), 0.0) as total_spend,
    COUNT(*) as extraction_count
FROM cloud_extraction_audit
WHERE strftime('%Y-%m', started_at) = strftime('%Y-%m', 'now')
  AND status IN ('success', 'started');  -- Include in-progress extractions
