-- scan_results: one row per (scan, query, provider)
-- Used by share-of-voice, opportunity-analyzer, competitor-reason-analyzer,
-- and the query explorer.

CREATE TABLE IF NOT EXISTS public.scan_results (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id               uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  query_text            text NOT NULL,
  query_category        text,              -- raw IntentCluster: direct_recommendation | alternatives | comparison | problem_based | feature_based | budget_based | user_provided. Nullable when unknown.
  provider              text NOT NULL,     -- canonical: openai | anthropic | google | perplexity
  model                 text,              -- e.g. gpt-5.4-mini, claude-haiku-4-5-20251001
  brand_mentioned       boolean NOT NULL DEFAULT false,
  brand_position        integer,           -- 1..N position when listed; null if not mentioned
  brand_sentiment       text,              -- positive | neutral | negative | null
  competitors_detected  jsonb NOT NULL DEFAULT '[]'::jsonb,  -- array of { name, position? }
  response_text         text,              -- full AI response
  latency_ms            integer,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Indexes for the three downstream consumers:
-- 1. share-of-voice aggregates by scan_id + provider
-- 2. opportunity-analyzer aggregates by scan_id
-- 3. competitor-reason-analyzer pulls response_text by scan_id
CREATE INDEX IF NOT EXISTS scan_results_scan_id_idx
  ON public.scan_results (scan_id);
CREATE INDEX IF NOT EXISTS scan_results_scan_provider_idx
  ON public.scan_results (scan_id, provider);
CREATE INDEX IF NOT EXISTS scan_results_brand_mentioned_idx
  ON public.scan_results (scan_id, brand_mentioned);

-- RLS
ALTER TABLE public.scan_results ENABLE ROW LEVEL SECURITY;

-- Service role manages everything (workers write here)
DROP POLICY IF EXISTS "Service role manages scan_results" ON public.scan_results;
CREATE POLICY "Service role manages scan_results"
  ON public.scan_results
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Users can read scan_results for their own brands' scans
DROP POLICY IF EXISTS "Users read own scan_results" ON public.scan_results;
CREATE POLICY "Users read own scan_results"
  ON public.scan_results
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.scans s
      JOIN public.brands b ON b.id = s.brand_id
      WHERE s.id = scan_results.scan_id
        AND b.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.scan_results IS
  'Per-query, per-provider results from a scan. One row = one (query, provider) pair.';
