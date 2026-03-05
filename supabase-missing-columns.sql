-- ============================================================
-- Missing columns on the scans table
-- The V3 scan pipeline writes to these columns but they were
-- never added by any migration. Run this ONCE in Supabase
-- SQL Editor to fix scan data persistence.
-- ============================================================

-- Core scan result columns
ALTER TABLE scans ADD COLUMN IF NOT EXISTS score INTEGER;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Summary JSONB — stores all post-scan enrichments:
--   provider_comparison, deltas, share_of_voice, opportunity,
--   competitor_reasons, content_opportunities
ALTER TABLE scans ADD COLUMN IF NOT EXISTS summary JSONB DEFAULT '{}'::jsonb;

-- Index for efficient summary queries
CREATE INDEX IF NOT EXISTS idx_scans_summary
  ON scans USING gin(summary);

-- Allow service role to insert/update scans (needed for sync scan path
-- where adminDb writes the scan row but RLS would block it)
DROP POLICY IF EXISTS "Service role can manage scans" ON scans;
CREATE POLICY "Service role can manage scans" ON scans
  FOR ALL USING (true) WITH CHECK (true);
