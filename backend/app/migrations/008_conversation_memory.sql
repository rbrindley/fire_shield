-- Conversation Memory for persistent user context
-- Migration: 008_conversation_memory.sql

CREATE TABLE IF NOT EXISTS conversation_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_profile_id TEXT NOT NULL,
    memory_type TEXT NOT NULL,
    memory_key TEXT NOT NULL,
    memory_value TEXT NOT NULL,
    memory_metadata TEXT,
    source_conversation_date TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (property_profile_id) REFERENCES property_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_conv_memory_profile ON conversation_memory(property_profile_id);
CREATE INDEX IF NOT EXISTS idx_conv_memory_type ON conversation_memory(memory_type, property_profile_id);
