-- Opportunity Scoring columns on conversations table
-- Stores per-conversation scores computed by the rule-based scoring engine

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS
  opportunity_score INTEGER DEFAULT 0;

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS
  opportunity_tier TEXT DEFAULT 'cold';

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS
  opportunity_signals JSONB;

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS
  opportunity_reasons TEXT[];

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS
  scored_at TIMESTAMPTZ;

-- Index for sorting by score (most common dashboard query)
CREATE INDEX IF NOT EXISTS idx_conversations_opportunity_score
  ON conversations(user_id, opportunity_score DESC);

-- Index for filtering by tier
CREATE INDEX IF NOT EXISTS idx_conversations_opportunity_tier
  ON conversations(user_id, opportunity_tier);
