import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { log } from "@/lib/logger"

const logger = log.create("scan-history-api")
export const dynamic = "force-dynamic"

/**
 * GET /api/scan-history/latest
 * Returns the most recent full scan result for the logged-in user.
 * Used by the dashboard to load per-user scan data instead of shared localStorage.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ scan: null, error: "Not authenticated" }, { status: 401 })
    }

    // Fetch the most recent scan with a full_result
    const { data, error } = await supabase
      .from("scan_history")
      .select("id, product_name, product_url, category, score, full_result, scanned_at")
      .eq("user_id", user.id)
      .not("full_result", "is", null)
      .order("scanned_at", { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows found, which is fine
      logger.error("Error fetching", { error: String(error) })
    }

    if (!data || !data.full_result) {
      return NextResponse.json({ scan: null })
    }

    // Try to fetch summary enrichments (deltas, share_of_voice) from the scans table
    let deltas = null
    let shareOfVoice = null
    try {
      const productUrl = data.product_url
      if (productUrl) {
        let summary: Record<string, unknown> | null = null

        const { data: scanRow } = await supabase
          .from("scans")
          .select("summary")
          .eq("status", "not_mentioned")
          .order("created_at", { ascending: false })
          .limit(1)
          .single()

        if (scanRow?.summary) {
          summary = scanRow.summary as Record<string, unknown>
        } else {
          const { data: altRow } = await supabase
            .from("scans")
            .select("summary")
            .in("status", ["low_visibility", "recommended"])
            .order("created_at", { ascending: false })
            .limit(1)
            .single()
          if (altRow?.summary) {
            summary = altRow.summary as Record<string, unknown>
          }
        }

        if (summary) {
          deltas = summary.deltas ?? null
          shareOfVoice = summary.share_of_voice ?? null
        }
      }
    } catch {
      // Non-fatal: old scans may not have enrichments
    }

    return NextResponse.json({
      scan: {
        id: data.id,
        productName: data.product_name,
        productUrl: data.product_url,
        category: data.category,
        score: data.score,
        scannedAt: data.scanned_at,
        fullResult: data.full_result,
        deltas,
        shareOfVoice,
      },
    })
  } catch (err) {
    logger.error("Exception", { error: String(err) })
    return NextResponse.json({ scan: null, error: "Failed to fetch" }, { status: 500 })
  }
}
