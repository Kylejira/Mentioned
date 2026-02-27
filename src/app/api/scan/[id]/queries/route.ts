import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { createAdminClient } from "@/lib/supabase-admin"
import { log } from "@/lib/logger"

export const dynamic = "force-dynamic"

const logger = log.create("scan-queries-api")

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: scanId } = await params

    if (!scanId) {
      return NextResponse.json({ error: "Missing scan ID" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const db = createAdminClient()

    const { data: scan, error: scanError } = await db
      .from("scans")
      .select("id, brand_id")
      .eq("id", scanId)
      .single()

    if (scanError || !scan) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 })
    }

    if (scan.brand_id) {
      const { data: brand } = await db
        .from("brands")
        .select("user_id")
        .eq("id", scan.brand_id)
        .single()

      if (brand && brand.user_id !== user.id) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
      }
    }

    const { data: results, error: resultsError } = await db
      .from("scan_results")
      .select("id, query_text, query_category, provider, model, brand_mentioned, brand_position, brand_sentiment, competitors_detected, response_text, latency_ms, created_at")
      .eq("scan_id", scanId)
      .order("created_at", { ascending: true })

    if (resultsError || !results) {
      logger.warn("Could not fetch scan results", {
        scanId,
        error: resultsError?.message,
      })
      return NextResponse.json({
        total: 0,
        results: [],
        filters: { providers: [], categories: [] },
      })
    }

    const providers = [...new Set(results.map((r: any) => r.provider).filter(Boolean))]
    const categories = [...new Set(results.map((r: any) => r.query_category).filter(Boolean))]

    return NextResponse.json({
      total: results.length,
      results,
      filters: { providers, categories },
    })
  } catch (err) {
    logger.error("Failed to fetch scan queries", { error: String(err) })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
