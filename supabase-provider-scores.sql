ALTER TABLE scans ADD COLUMN IF NOT EXISTS provider_scores JSONB DEFAULT '[]'::jsonb;
