-- Fire Shield - Initial Database Schema
-- Adapted from x12_ai_guide reference codebase
-- Domain: wildfire prevention PWA for Rogue Valley, Oregon

-- =============================================================================
-- JURISDICTIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS jurisdictions (
    code TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    parent_code TEXT REFERENCES jurisdictions(code),
    jurisdiction_chain TEXT NOT NULL  -- JSON array, precomputed
);

-- =============================================================================
-- DOCUMENTS & CHUNKS (jurisdiction + trust_tier replace doc_type/subtype)
-- =============================================================================

CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT,
    title TEXT NOT NULL,
    jurisdiction TEXT NOT NULL,
    trust_tier INTEGER NOT NULL,  -- 1=local code, 2=authoritative, 3=fire science, 4=community, 5=grants, 6=educational
    source_url TEXT,
    document_date TEXT,
    description TEXT,
    status TEXT DEFAULT 'active',  -- 'active', 'stale', 'pending'
    superseded_by INTEGER REFERENCES documents(id),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    is_active INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_documents_jurisdiction ON documents(jurisdiction);
CREATE INDEX IF NOT EXISTS idx_documents_trust_tier ON documents(trust_tier);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);

CREATE TABLE IF NOT EXISTS document_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    version INTEGER NOT NULL,
    file_hash TEXT,
    file_path TEXT,
    page_count INTEGER,
    extraction_status TEXT DEFAULT 'pending',
    extraction_error TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    UNIQUE(document_id, version)
);

CREATE TABLE IF NOT EXISTS chunks (
    id TEXT PRIMARY KEY,  -- UUID
    doc_version_id INTEGER NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    page_start INTEGER NOT NULL DEFAULT 0,
    page_end INTEGER NOT NULL DEFAULT 0,
    section_title TEXT,
    jurisdiction TEXT NOT NULL,
    trust_tier INTEGER NOT NULL,
    has_table INTEGER DEFAULT 0,
    token_count INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (doc_version_id) REFERENCES document_versions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chunks_doc_version ON chunks(doc_version_id);
CREATE INDEX IF NOT EXISTS idx_chunks_jurisdiction ON chunks(jurisdiction);
CREATE INDEX IF NOT EXISTS idx_chunks_trust_tier ON chunks(trust_tier);
CREATE INDEX IF NOT EXISTS idx_chunks_page ON chunks(page_start, page_end);

-- FTS5 virtual table for full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
    chunk_id,
    content,
    section_title,
    jurisdiction
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
    INSERT INTO chunks_fts(rowid, chunk_id, content, section_title, jurisdiction)
    VALUES (NEW.rowid, NEW.id, NEW.content, NEW.section_title, NEW.jurisdiction);
END;

CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
    INSERT INTO chunks_fts(chunks_fts, rowid, chunk_id, content, section_title, jurisdiction)
    VALUES ('delete', OLD.rowid, OLD.id, OLD.content, OLD.section_title, OLD.jurisdiction);
END;

CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
    INSERT INTO chunks_fts(chunks_fts, rowid, chunk_id, content, section_title, jurisdiction)
    VALUES ('delete', OLD.rowid, OLD.id, OLD.content, OLD.section_title, OLD.jurisdiction);
    INSERT INTO chunks_fts(rowid, chunk_id, content, section_title, jurisdiction)
    VALUES (NEW.rowid, NEW.id, NEW.content, NEW.section_title, NEW.jurisdiction);
END;

-- =============================================================================
-- PROPERTY PROFILES
-- =============================================================================

CREATE TABLE IF NOT EXISTS property_profiles (
    id TEXT PRIMARY KEY,  -- UUID
    address TEXT NOT NULL,
    lat REAL,
    lng REAL,
    jurisdiction_code TEXT,
    roof_type TEXT,
    siding_type TEXT,
    has_deck INTEGER DEFAULT 0,
    has_attached_fence INTEGER DEFAULT 0,
    slope_category TEXT,
    session_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_property_profiles_session ON property_profiles(session_id);

-- =============================================================================
-- PLANTS (canonical schema from LWF adapter)
-- =============================================================================

CREATE TABLE IF NOT EXISTS plants (
    id TEXT PRIMARY KEY,
    common_name TEXT NOT NULL,
    scientific_name TEXT,
    plant_type TEXT,
    zone_0_5ft INTEGER DEFAULT 0,
    zone_5_30ft INTEGER DEFAULT 0,
    zone_30_100ft INTEGER DEFAULT 0,
    zone_100ft_plus INTEGER DEFAULT 0,
    character_score REAL,
    water_need TEXT,
    is_native INTEGER DEFAULT 0,
    deer_resistant INTEGER DEFAULT 0,
    pollinator_support INTEGER DEFAULT 0,
    sun TEXT,
    mature_height_min_ft REAL,
    mature_height_max_ft REAL,
    mature_width_min_ft REAL,
    mature_width_max_ft REAL,
    fire_behavior_notes TEXT,
    placement_notes TEXT,
    ashland_restricted INTEGER DEFAULT 0,
    ashland_restriction_type TEXT,
    is_noxious_weed INTEGER DEFAULT 0,
    primary_image_url TEXT,
    source TEXT DEFAULT 'lwf',
    source_url TEXT,
    last_synced TEXT
);

CREATE INDEX IF NOT EXISTS idx_plants_zone_0_5ft ON plants(zone_0_5ft);
CREATE INDEX IF NOT EXISTS idx_plants_zone_5_30ft ON plants(zone_5_30ft);
CREATE INDEX IF NOT EXISTS idx_plants_is_native ON plants(is_native);
CREATE INDEX IF NOT EXISTS idx_plants_deer_resistant ON plants(deer_resistant);
CREATE INDEX IF NOT EXISTS idx_plants_ashland_restricted ON plants(ashland_restricted);

-- Plant sync log
CREATE TABLE IF NOT EXISTS plant_sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    synced_at TEXT DEFAULT (datetime('now')),
    plants_upserted INTEGER DEFAULT 0,
    plants_new INTEGER DEFAULT 0,
    plants_unchanged INTEGER DEFAULT 0,
    status TEXT NOT NULL,
    error_message TEXT
);

-- =============================================================================
-- ZONE ACTIONS (seeded from layer_80_20_steps.md — 17 actions total)
-- =============================================================================

CREATE TABLE IF NOT EXISTS zone_actions (
    id TEXT PRIMARY KEY,
    layer INTEGER NOT NULL,
    layer_name TEXT NOT NULL,
    rank_in_layer INTEGER NOT NULL,
    action_title TEXT NOT NULL,
    action_detail TEXT NOT NULL,
    why_it_matters TEXT NOT NULL,
    evidence_citation TEXT NOT NULL,
    effort_level TEXT,
    cost_estimate TEXT,
    time_estimate TEXT,
    seasonal_peak TEXT,   -- JSON array e.g. '["may","june"]'
    priority_score REAL NOT NULL,
    neighbor_effect INTEGER DEFAULT 0
);

-- =============================================================================
-- CORPUS SOURCES (admin-managed document registry)
-- =============================================================================

CREATE TABLE IF NOT EXISTS corpus_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    source_url TEXT,
    jurisdiction TEXT NOT NULL,
    trust_tier INTEGER NOT NULL,
    document_date TEXT,
    ingestion_date TEXT DEFAULT (datetime('now')),
    status TEXT DEFAULT 'active',
    supersedes_id INTEGER REFERENCES corpus_sources(id),
    document_id INTEGER REFERENCES documents(id)
);

-- =============================================================================
-- SUBSCRIPTIONS (notification agent — Phase 2)
-- =============================================================================

CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    property_profile_id TEXT REFERENCES property_profiles(id),
    notification_categories TEXT NOT NULL,
    frequency TEXT DEFAULT 'weekly_digest',
    channel TEXT DEFAULT 'email',
    created_at TEXT DEFAULT (datetime('now')),
    last_sent_at TEXT
);

-- =============================================================================
-- AUDIT & QUERY TRACING
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT DEFAULT (datetime('now')),
    event_type TEXT NOT NULL,
    event_data TEXT,
    ip_address TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);

CREATE TABLE IF NOT EXISTS query_traces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT DEFAULT (datetime('now')),
    session_id TEXT,
    property_profile_id TEXT,
    jurisdiction_code TEXT,
    model TEXT NOT NULL,
    profile TEXT NOT NULL,
    question TEXT,
    retrieval_time_ms INTEGER,
    rerank_time_ms INTEGER,
    generation_time_ms INTEGER,
    total_time_ms INTEGER,
    chunks_retrieved INTEGER,
    chunks_after_rerank INTEGER,
    citations_count INTEGER,
    nws_alert_called INTEGER DEFAULT 0,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_query_traces_timestamp ON query_traces(timestamp);
CREATE INDEX IF NOT EXISTS idx_query_traces_jurisdiction ON query_traces(jurisdiction_code);

CREATE TABLE IF NOT EXISTS ingestion_traces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_version_id INTEGER NOT NULL,
    timestamp TEXT DEFAULT (datetime('now')),
    extraction_time_s REAL,
    chunking_time_s REAL,
    embedding_time_s REAL,
    indexing_time_s REAL,
    total_time_s REAL,
    total_pages INTEGER,
    total_chunks INTEGER,
    status TEXT NOT NULL,
    error_message TEXT
);
