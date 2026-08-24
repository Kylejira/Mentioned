-- Reconciliation: add columns the code writes that are absent from production.
-- Verified missing via service-role probe on 2026-05-11:
--   - scans.stage     (referenced by scan-runner.ts:31 + scan-worker.ts:192 + status route)
--   - scans.progress  (referenced by scan-runner.ts:31 + status route)
-- All other "scan-form" columns (core_problem, target_buyer, differentiators,
-- buyer_questions, is_public, lead_email) are already present.
--
-- `IF NOT EXISTS` keeps this a no-op on any environment where the columns
-- already exist.

ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS stage    text,
  ADD COLUMN IF NOT EXISTS progress integer DEFAULT 0;
