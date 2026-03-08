-- AI Reply Generator tables
-- 1. product_profiles: stores each user's product context for reply generation
-- 2. reply_generations: generation log for rate limiting and analytics

-- ============================================================================
-- product_profiles
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  product_name TEXT NOT NULL,
  one_liner TEXT NOT NULL,
  description TEXT,
  key_features TEXT[],
  target_audience TEXT,
  use_cases TEXT[],
  competitors TEXT[],
  website_url TEXT,
  preferred_tone TEXT DEFAULT 'helpful'
    CHECK (preferred_tone IN ('casual', 'professional', 'helpful', 'expert')),
  custom_instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE product_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own product profile"
  ON product_profiles FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on product_profiles"
  ON product_profiles FOR ALL
  USING (true) WITH CHECK (true);

-- ============================================================================
-- reply_generations
-- ============================================================================

CREATE TABLE IF NOT EXISTS reply_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  conversation_id UUID NOT NULL,
  replies_count INTEGER NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reply_gen_user_date
  ON reply_generations(user_id, created_at DESC);

ALTER TABLE reply_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reply generations"
  ON reply_generations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reply generations"
  ON reply_generations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access on reply_generations"
  ON reply_generations FOR ALL
  USING (true) WITH CHECK (true);
