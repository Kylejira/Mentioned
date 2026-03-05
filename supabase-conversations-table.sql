-- Create the conversations table with all columns including opportunity scoring
-- This replaces supabase-opportunity-scoring.sql (which assumed the table existed)

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scan_id UUID REFERENCES scans(id) ON DELETE SET NULL,

  -- Core conversation data
  text TEXT NOT NULL DEFAULT '',
  full_thread_text TEXT,
  title TEXT,
  url TEXT,
  platform TEXT NOT NULL DEFAULT 'unknown',
  posted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  author TEXT,
  engagement JSONB DEFAULT '{}',

  -- Reply tracking
  replied_at TIMESTAMPTZ,

  -- Opportunity scoring (populated by scoring engine)
  opportunity_score INTEGER DEFAULT 0,
  opportunity_tier TEXT DEFAULT 'cold',
  opportunity_signals JSONB,
  opportunity_reasons TEXT[],
  scored_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user_id
  ON conversations(user_id);

CREATE INDEX IF NOT EXISTS idx_conversations_scan_id
  ON conversations(scan_id);

CREATE INDEX IF NOT EXISTS idx_conversations_opportunity_score
  ON conversations(user_id, opportunity_score DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_opportunity_tier
  ON conversations(user_id, opportunity_tier);

CREATE INDEX IF NOT EXISTS idx_conversations_created_at
  ON conversations(created_at DESC);

-- RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations"
  ON conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role bypass for conversations"
  ON conversations FOR ALL
  USING (true) WITH CHECK (true);

-- RPC function to efficiently count conversations per tier for filter chips
CREATE OR REPLACE FUNCTION count_conversation_tiers(p_user_id UUID)
RETURNS TABLE(tier TEXT, count BIGINT)
LANGUAGE sql
STABLE
AS $$
  SELECT
    opportunity_tier AS tier,
    COUNT(*)::BIGINT AS count
  FROM conversations
  WHERE user_id = p_user_id
  GROUP BY opportunity_tier;
$$;
