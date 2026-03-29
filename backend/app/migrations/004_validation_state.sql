-- Validation State for Extraction Checkpoints
-- Migration: 004_validation_state.sql

-- =============================================================================
-- ADD VALIDATION STATE COLUMN
-- =============================================================================
-- Stores per-chunk validation results and halt state.
-- JSON format for flexibility in tracking validation metrics.

ALTER TABLE extraction_checkpoints 
ADD COLUMN validation_state_json TEXT;

-- =============================================================================
-- NOTES
-- =============================================================================
-- 
-- validation_state_json stores:
-- {
--   "total_chunks": 28,
--   "validated_chunks": 15,
--   "passed_chunks": 14,
--   "failed_chunks": 1,
--   "pass_rate": 93.3,
--   "halted": false,
--   "halt_reason": null
-- }
--
-- Halt conditions:
-- - 3 consecutive chunk failures
-- - 6 out of 10 chunks fail (rolling window)
