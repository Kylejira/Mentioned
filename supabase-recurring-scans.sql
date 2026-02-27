-- Add recurring scan configuration columns to scans table
-- Safe: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS

ALTER TABLE scans ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS recurring_interval TEXT DEFAULT NULL;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMPTZ DEFAULT NULL;

-- Index for efficiently finding scans that are due to run
CREATE INDEX IF NOT EXISTS idx_scans_next_run
  ON scans (next_run_at)
  WHERE is_recurring = true AND next_run_at IS NOT NULL;

-- Constraint: recurring_interval must be a known value when set
ALTER TABLE scans DROP CONSTRAINT IF EXISTS chk_recurring_interval;
ALTER TABLE scans ADD CONSTRAINT chk_recurring_interval
  CHECK (recurring_interval IS NULL OR recurring_interval IN ('weekly', 'monthly'));
