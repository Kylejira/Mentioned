CREATE TABLE IF NOT EXISTS action_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_id TEXT NOT NULL UNIQUE,
  executive_summary TEXT,
  visibility_breakdown JSONB,
  competitive_gaps JSONB,
  opportunities JSONB,
  roadmap_30_days JSONB,
  content_recommendations JSONB,
  actions JSONB DEFAULT '[]'::jsonb,
  reasoning TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration for existing tables
ALTER TABLE action_plans ADD COLUMN IF NOT EXISTS actions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE action_plans ADD COLUMN IF NOT EXISTS reasoning TEXT;

CREATE INDEX IF NOT EXISTS idx_action_plans_scan_id ON action_plans (scan_id);

ALTER TABLE action_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage action_plans"
  ON action_plans
  FOR ALL
  USING (true)
  WITH CHECK (true);
