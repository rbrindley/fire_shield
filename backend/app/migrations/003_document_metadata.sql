-- Enhanced Document Metadata for Filtering
-- Migration: 003_document_metadata.sql

-- =============================================================================
-- ADD METADATA COLUMNS TO DOCUMENTS
-- =============================================================================

-- Add sub-type for 837 variants (I=Institutional, P=Professional, D=Dental)
ALTER TABLE documents ADD COLUMN doc_subtype TEXT;

-- Add X12 implementation guide version (e.g., '005010X222A2')
ALTER TABLE documents ADD COLUMN x12_version TEXT;

-- Add effective date for the guide version
ALTER TABLE documents ADD COLUMN effective_date TEXT;

-- Add source organization (ASC X12, CAQH CORE, CMS, etc.)
ALTER TABLE documents ADD COLUMN source_org TEXT DEFAULT 'ASC X12';

-- Add errata indicator (is this an errata document?)
ALTER TABLE documents ADD COLUMN is_errata INTEGER DEFAULT 0;

-- Add base document reference for erratas (which main doc does this errata apply to?)
ALTER TABLE documents ADD COLUMN errata_for_doc_id INTEGER REFERENCES documents(id);

-- =============================================================================
-- INDEXES FOR FILTERING
-- =============================================================================

-- idx_documents_doc_type removed: doc_type column does not exist in fire_shield schema
CREATE INDEX IF NOT EXISTS idx_documents_doc_subtype ON documents(doc_subtype);
CREATE INDEX IF NOT EXISTS idx_documents_x12_version ON documents(x12_version);
CREATE INDEX IF NOT EXISTS idx_documents_effective_date ON documents(effective_date);
CREATE INDEX IF NOT EXISTS idx_documents_is_errata ON documents(is_errata);

-- =============================================================================
-- USAGE EXAMPLES
-- =============================================================================
--
-- Filter by 837 sub-type:
--   SELECT * FROM documents WHERE doc_type = '837' AND doc_subtype = 'I'
--
-- Get all 837P documents:
--   SELECT * FROM documents WHERE doc_type = '837' AND doc_subtype = 'P'
--
-- Get latest version of a specific X12 guide:
--   SELECT * FROM documents 
--   WHERE x12_version = '005010X222A2' 
--   ORDER BY effective_date DESC LIMIT 1
--
-- Get all erratas for a base document:
--   SELECT * FROM documents WHERE errata_for_doc_id = 123
--
-- =============================================================================
-- DOC_SUBTYPE VALUES
-- =============================================================================
-- For doc_type = '837':
--   'I' = Institutional (hospital, skilled nursing)
--   'P' = Professional (physician, supplier)
--   'D' = Dental
--
-- For doc_type = '270'/'271':
--   NULL (no sub-types)
--
-- For doc_type = '835':
--   NULL (no sub-types, but could add 'I', 'P', 'D' if needed)
