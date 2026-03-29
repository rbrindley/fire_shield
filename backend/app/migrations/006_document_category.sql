-- Migration 006: Add document category for smart filtering
-- Categories: 'full_guide', 'addendum', 'errata'

-- Add category column (defaults to 'full_guide' for existing documents)
ALTER TABLE documents ADD COLUMN doc_category TEXT DEFAULT 'full_guide';

-- Index for filtering by category
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(doc_category);

-- =============================================================================
-- CATEGORY VALUES
-- =============================================================================
-- 'full_guide' = Complete implementation guide (the main document)
-- 'addendum'   = Supplemental material that extends the guide
-- 'errata'     = Corrections to an existing guide
--
-- =============================================================================
-- SMART FILTERING LOGIC
-- =============================================================================
-- When user selects a doc_type (e.g., '837P'):
-- 1. Find the most recent full_guide for that type (by release_date)
-- 2. Include any addenda/errata released AFTER that full_guide's release_date
--    OR that reference it via errata_for_doc_id
-- 3. Skip older full_guides and their associated addenda/errata
--
-- Example query to get "smart" document set for 837P:
-- 
-- WITH latest_guide AS (
--     SELECT id, release_date FROM documents
--     WHERE doc_type = '837' AND doc_subtype = 'P' 
--       AND doc_category = 'full_guide' AND is_active = 1
--     ORDER BY release_date DESC LIMIT 1
-- )
-- SELECT d.id FROM documents d
-- LEFT JOIN latest_guide lg ON 1=1
-- WHERE d.doc_type = '837' AND d.doc_subtype = 'P' AND d.is_active = 1
--   AND (
--     d.id = lg.id  -- The latest full guide
--     OR d.errata_for_doc_id = lg.id  -- Errata for the latest guide
--     OR (d.doc_category IN ('addendum', 'errata') 
--         AND d.release_date >= lg.release_date)  -- Addenda/errata after release
--   )
