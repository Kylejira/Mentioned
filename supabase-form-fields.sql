-- Migration: add form-sourced fields to scans table
-- Safe additive migration — no existing columns modified

ALTER TABLE scans ADD COLUMN IF NOT EXISTS core_problem TEXT;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS target_buyer TEXT;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS differentiators TEXT;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS buyer_questions JSONB DEFAULT '[]';

-- Optional: full-text index for analytics queries
CREATE INDEX IF NOT EXISTS idx_scans_core_problem
  ON scans USING gin(to_tsvector('english', COALESCE(core_problem, '')));
