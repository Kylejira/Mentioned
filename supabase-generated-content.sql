-- Generated Content table for AI Visibility Fix Generator
-- Stores on-demand content produced by LLM (comparison pages, answer pages, FAQ sets, positioning briefs)
-- Run this SQL in your Supabase dashboard: SQL Editor > New Query

-- 1. Create the table
CREATE TABLE IF NOT EXISTS generated_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('comparison', 'answer_page', 'faq', 'positioning')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'generated' CHECK (status IN ('generating', 'generated', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_generated_content_user_scan
  ON generated_content (user_id, scan_id);

CREATE INDEX IF NOT EXISTS idx_generated_content_type
  ON generated_content (type);

-- 3. RLS — users can only access their own content
ALTER TABLE generated_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own generated content" ON generated_content;
CREATE POLICY "Users can view their own generated content"
  ON generated_content FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own generated content" ON generated_content;
CREATE POLICY "Users can insert their own generated content"
  ON generated_content FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own generated content" ON generated_content;
CREATE POLICY "Users can update their own generated content"
  ON generated_content FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own generated content" ON generated_content;
CREATE POLICY "Users can delete their own generated content"
  ON generated_content FOR DELETE
  USING (auth.uid() = user_id);
