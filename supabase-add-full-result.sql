-- ============================================
-- ADD FULL RESULT COLUMN TO SCAN_HISTORY
-- This allows the dashboard to load per-user scan data from the database
-- instead of relying on shared localStorage
-- ============================================

-- Add full_result JSONB column to store the complete scan result
ALTER TABLE scan_history ADD COLUMN IF NOT EXISTS full_result jsonb;

-- Create index for fast lookups of latest scan per user
CREATE INDEX IF NOT EXISTS scan_history_user_latest_idx 
  ON scan_history(user_id, scanned_at DESC);
