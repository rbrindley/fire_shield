-- Cloud instance lifecycle event tracking
-- Provides visibility into GPU instance costs and status

CREATE TABLE IF NOT EXISTS cloud_instance_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instance_id TEXT NOT NULL,
    provider TEXT NOT NULL,           -- 'runpod', 'vastai', 'modal'
    event_type TEXT NOT NULL,         -- 'created', 'ready', 'heartbeat', 'terminated', 'error'
    gpu_type TEXT,
    cost_per_hour REAL,
    document_id INTEGER,              -- Which doc triggered this
    document_title TEXT,              -- Denormalized for display
    details TEXT,                     -- JSON blob for extra info
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id)
);

CREATE INDEX IF NOT EXISTS idx_cloud_events_instance ON cloud_instance_events(instance_id);
CREATE INDEX IF NOT EXISTS idx_cloud_events_provider ON cloud_instance_events(provider);
CREATE INDEX IF NOT EXISTS idx_cloud_events_created ON cloud_instance_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cloud_events_type ON cloud_instance_events(event_type);
