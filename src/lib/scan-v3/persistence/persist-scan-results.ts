import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase-admin"
import { normalizeProvider, PROVIDER_MODELS } from "@/lib/providers/names"
import { log } from "@/lib/logger"
import type { ResponseAnalysis } from "@/lib/scan-v3/detection/types"

const logger = log.create("persist-scan-results")

interface CompetitorDetectedRow {
  name: string
  position?: number
}

export interface ScanResultRow {
  scan_id: string
  query_text: string
  query_category: string | null
  provider: string
  model: string | null
  brand_mentioned: boolean
  brand_position: number | null
  brand_sentiment: string | null
  competitors_detected: CompetitorDetectedRow[]
  response_text: string | null
  latency_ms: number | null
}

export interface PersistResult {
  inserted: number
  skipped: number
  error: string | null
}

const BATCH_SIZE = 500

/**
 * Persist one row per (query, provider) from a scan's analyses into the
 * scan_results table.
 *
 * Downstream consumers (share-of-voice, opportunity-analyzer,
 * competitor-reason-analyzer) read from this table. They are unaware of
 * the upstream ResponseAnalysis shape — this function is the only place
 * that maps between the two.
 *
 * Failures are non-fatal: the caller should log and continue. Returns
 * `{ inserted, skipped, error }` so callers can surface progress.
 */
export async function persistScanResults(
  scanId: string,
  analyses: ResponseAnalysis[],
  supabase?: SupabaseClient,
): Promise<PersistResult> {
  if (!analyses || analyses.length === 0) {
    return { inserted: 0, skipped: 0, error: null }
  }

  const db = supabase ?? createAdminClient()

  const rows: ScanResultRow[] = []
  let skipped = 0

  for (const a of analyses) {
    const canonical = normalizeProvider(a.provider)
    if (!canonical) {
      logger.warn("Unknown provider in analysis — skipping row", {
        scanId,
        provider: a.provider,
        query: a.query?.text?.slice(0, 80),
      })
      skipped++
      continue
    }

    const competitors: CompetitorDetectedRow[] = (a.competitor_detections ?? [])
      .filter((c) => c?.detected === true && typeof c?.brand_name === "string" && c.brand_name.length > 0)
      .map((c) => {
        const row: CompetitorDetectedRow = { name: c.brand_name }
        if (typeof c.position === "number") row.position = c.position
        return row
      })

    rows.push({
      scan_id: scanId,
      query_text: a.query?.text ?? "",
      query_category: a.query?.intent ?? null,
      provider: canonical,
      model: PROVIDER_MODELS[canonical] ?? null,
      brand_mentioned: Boolean(a.brand_detection?.detected),
      brand_position: a.brand_detection?.position ?? null,
      brand_sentiment: a.brand_sentiment ?? null,
      competitors_detected: competitors,
      response_text: a.raw_response ?? null,
      latency_ms: null,
    })
  }

  if (rows.length === 0) {
    return { inserted: 0, skipped, error: null }
  }

  let inserted = 0
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { error, count } = await db
      .from("scan_results")
      .insert(batch, { count: "exact" })

    if (error) {
      logger.error("Insert failed", {
        scanId,
        batchStart: i,
        batchSize: batch.length,
        error: error.message,
      })
      return { inserted, skipped, error: error.message }
    }
    inserted += count ?? batch.length
  }

  logger.info("Persisted scan_results", { scanId, inserted, skipped })
  return { inserted, skipped, error: null }
}
