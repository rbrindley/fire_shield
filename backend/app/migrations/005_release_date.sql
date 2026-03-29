-- Migration 005: Add document release date
-- Stores the publication/release date of the X12 Implementation Guide

ALTER TABLE documents ADD COLUMN release_date TEXT;

-- Index for sorting by release date
CREATE INDEX IF NOT EXISTS idx_documents_release_date ON documents(release_date);
