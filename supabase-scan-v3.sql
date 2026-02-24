-- ============================================================
-- Scan V3 Schema Migrations
-- Run these ONCE against your Supabase project.
-- All changes are additive — zero modifications to existing data.
-- ============================================================

-- Migration 1: scan_query_sets table (stores validated query sets per scan)
CREATE TABLE IF NOT EXISTS scan_query_sets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_id UUID NOT NULL,
  queries JSONB NOT NULL DEFAULT '[]',
  total_generated INTEGER NOT NULL DEFAULT 0,
  total_validated INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(scan_id)
);

CREATE INDEX IF NOT EXISTS idx_scan_query_sets_scan_id
  ON scan_query_sets(scan_id);

-- RLS: users can only see their own query sets (via scan ownership)
ALTER TABLE scan_query_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own query sets" ON scan_query_sets
  FOR SELECT USING (
    scan_id IN (
      SELECT s.id FROM scans s
      JOIN brands b ON s.brand_id = b.id
      WHERE b.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own query sets" ON scan_query_sets
  FOR INSERT WITH CHECK (
    scan_id IN (
      SELECT s.id FROM scans s
      JOIN brands b ON s.brand_id = b.id
      WHERE b.user_id = auth.uid()
    )
  );

-- Migration 2: competitor_tracking table (lightweight competitor persistence)
CREATE TABLE IF NOT EXISTS competitor_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_domain TEXT NOT NULL,
  competitor_name TEXT NOT NULL,
  rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 3),
  last_mention_count INTEGER NOT NULL DEFAULT 0,
  last_avg_position REAL NOT NULL DEFAULT 99,
  trend TEXT NOT NULL DEFAULT 'new' CHECK (trend IN ('up', 'down', 'stable', 'new')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(brand_domain, competitor_name)
);

CREATE INDEX IF NOT EXISTS idx_competitor_tracking_brand
  ON competitor_tracking(brand_domain);

ALTER TABLE competitor_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view competitor tracking" ON competitor_tracking
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage competitor tracking" ON competitor_tracking
  FOR ALL USING (true) WITH CHECK (true);

-- Migration 3: Add columns to existing scans table
ALTER TABLE scans ADD COLUMN IF NOT EXISTS score_breakdown JSONB;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS saas_profile JSONB;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS query_count INTEGER;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS scan_version TEXT DEFAULT 'v1';
