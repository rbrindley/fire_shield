-- Enhanced Document Metadata for Filtering
-- Migration: 003_document_metadata.sql

-- =============================================================================
-- ADD METADATA COLUMNS TO DOCUMENTS
-- =============================================================================

-- Add sub-type column for document variants
ALTER TABLE documents ADD COLUMN doc_subtype TEXT;

-- Add version identifier for the document standard
ALTER TABLE documents ADD COLUMN x12_version TEXT;

-- Add effective date for the document version
ALTER TABLE documents ADD COLUMN effective_date TEXT;

-- Add source organization
ALTER TABLE documents ADD COLUMN source_org TEXT DEFAULT 'ASC X12';

-- Add errata indicator (is this an errata document?)
ALTER TABLE documents ADD COLUMN is_errata INTEGER DEFAULT 0;

-- Add base document reference for erratas (which main doc does this errata apply to?)
ALTER TABLE documents ADD COLUMN errata_for_doc_id INTEGER REFERENCES documents(id);

-- =============================================================================
-- INDEXES FOR FILTERING
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_documents_doc_subtype ON documents(doc_subtype);
CREATE INDEX IF NOT EXISTS idx_documents_x12_version ON documents(x12_version);
CREATE INDEX IF NOT EXISTS idx_documents_effective_date ON documents(effective_date);
CREATE INDEX IF NOT EXISTS idx_documents_is_errata ON documents(is_errata);
