-- ============================================================
-- Public Scans Migration
-- Adds support for unauthenticated, shareable scans.
-- All changes are additive — zero impact on existing data.
-- Run this ONCE against your Supabase project.
-- ============================================================

-- 1. Mark a scan as publicly shareable.
--    Public scans can be read by anyone via /scan/[id] and the public status API.
--    All scans default to FALSE (existing behavior unchanged).
ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Optional email captured at scan time (for follow-up / lead capture).
--    Nullable — public scans can run without an email.
ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS lead_email TEXT;

-- 3. Index public scans for fast listing/abuse monitoring.
CREATE INDEX IF NOT EXISTS idx_scans_public_created
  ON scans(is_public, created_at DESC)
  WHERE is_public = TRUE;

-- ============================================================
-- RLS notes:
-- Existing scans table RLS is unchanged. Public scans are read
-- via the service-role admin client in API routes, which bypasses
-- RLS — read access is gated in application code (see /api/scan/[id]/status).
-- ============================================================
