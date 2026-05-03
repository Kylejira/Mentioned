import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { createAdminClient } from "@/lib/supabase-admin"
import { log } from "@/lib/logger"

export const dynamic = "force-dynamic"

const logger = log.create("scan-status-api")

/**
 * GET /api/scan/[id]/status
 *
 * Access control:
 *   - PUBLIC scans (is_public = true) are readable by anyone
 *   - PRIVATE scans require an authenticated session AND ownership
 *     (the user must own the brand the scan belongs to)
 *   - All other requests return 404 to avoid leaking scan existence (IDOR-safe)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: scanId } = await params

    if (!scanId) {
      return NextResponse.json({ error: "Missing scan ID" }, { status: 400 })
    }

    const adminDb = createAdminClient()

    const { data: scan, error: scanError } = await adminDb
      .from("scans")
      .select(
        "id, status, stage, progress, score, score_breakdown, saas_profile, query_count, scan_version, summary, brand_id, is_public, created_at"
      )
      .eq("id", scanId)
      .single()

    if (scanError || !scan) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 })
    }

    // ── Access check ──
    const isPublic = scan.is_public === true
    if (!isPublic) {
      // Private scan: require session + ownership.
      const userClient = await createClient()
      const { data: { user } } = await userClient.auth.getUser()

      if (!user) {
        return NextResponse.json({ error: "Scan not found" }, { status: 404 })
      }

      // Verify the requesting user owns this scan via brand ownership.
      if (!scan.brand_id) {
        return NextResponse.json({ error: "Scan not found" }, { status: 404 })
      }

      const { data: brand } = await adminDb
        .from("brands")
        .select("user_id")
        .eq("id", scan.brand_id)
        .maybeSingle()

      if (!brand || brand.user_id !== user.id) {
        return NextResponse.json({ error: "Scan not found" }, { status: 404 })
      }
    }

    const status = scan.status as string
    const stage = (scan.stage as string) || null
    const progress = (scan.progress as number) || 0

    if (status === "failed") {
      return NextResponse.json({
        scanId,
        status: "failed",
        stage,
        progress,
        score: null,
        result: null,
        isPublic,
      })
    }

    if (status === "queued" || status === "processing") {
      return NextResponse.json({
        scanId,
        status,
        stage,
        progress,
        score: null,
        result: null,
        isPublic,
      })
    }

    // Scan is complete — pull the legacy_result from summary first (works for
    // both public and private scans). Fall back to scan_history for older
    // private scans that pre-date the legacy_result-in-summary persistence.
    const summary = (scan.summary as Record<string, unknown> | null) || null
    let fullResult: Record<string, unknown> | null = null

    if (summary && summary.legacy_result) {
      fullResult = summary.legacy_result as Record<string, unknown>
    } else if (!isPublic) {
      // Legacy fallback for older private scans (looked up by URL).
      const profileUrl = (scan.saas_profile as Record<string, unknown> | null)?.website_url as string | undefined
      if (profileUrl) {
        const { data: history } = await adminDb
          .from("scan_history")
          .select("full_result")
          .eq("product_url", profileUrl)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
        fullResult = (history?.full_result as Record<string, unknown>) || null
      }
    }

    return NextResponse.json({
      scanId,
      status: "complete",
      stage: "complete",
      progress: 100,
      score: scan.score,
      result: fullResult,
      summary, // includes provider_comparison, deltas, share_of_voice, opportunity, etc.
      isPublic,
    })
  } catch (error) {
    logger.error("Failed to get scan status", { error: String(error) })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
