-- Auto-Discovery Sessions table
-- Stores each auto-discovery session: URL input, extracted profile, generated queries, user selections

CREATE TABLE IF NOT EXISTS auto_discovery_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  source_url TEXT NOT NULL,
  product_profile JSONB NOT NULL,
  generated_queries JSONB NOT NULL,
  selected_queries JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'activated')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_auto_discovery_sessions_user_id
  ON auto_discovery_sessions(user_id);

-- Index for sorting by recency
CREATE INDEX IF NOT EXISTS idx_auto_discovery_sessions_created_at
  ON auto_discovery_sessions(created_at DESC);

-- RLS: users can only access their own sessions
ALTER TABLE auto_discovery_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own auto-discovery sessions"
  ON auto_discovery_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own auto-discovery sessions"
  ON auto_discovery_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own auto-discovery sessions"
  ON auto_discovery_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role bypass for server-side operations
CREATE POLICY "Service role full access on auto_discovery_sessions"
  ON auto_discovery_sessions FOR ALL
  USING (auth.role() = 'service_role');
