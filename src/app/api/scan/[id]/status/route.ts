import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { log } from "@/lib/logger"

export const dynamic = "force-dynamic"

const logger = log.create("scan-status-api")

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: scanId } = await params

    if (!scanId) {
      return NextResponse.json({ error: "Missing scan ID" }, { status: 400 })
    }

    const db = createAdminClient()

    const { data: scan, error: scanError } = await db
      .from("scans")
      .select("id, status, stage, progress, score, score_breakdown, saas_profile, query_count, scan_version, created_at")
      .eq("id", scanId)
      .single()

    if (scanError || !scan) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 })
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
      })
    }

    // Scan is complete — fetch the full result from scan_history
    const profileUrl = (scan.saas_profile as Record<string, unknown>)?.website_url as string | undefined
    let fullResult = null

    if (profileUrl) {
      const { data: history } = await db
        .from("scan_history")
        .select("full_result")
        .eq("product_url", profileUrl)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      fullResult = history?.full_result || null
    }

    return NextResponse.json({
      scanId,
      status: "complete",
      stage: "complete",
      progress: 100,
      score: scan.score,
      result: fullResult,
    })
  } catch (error) {
    logger.error("Failed to get scan status", { error: String(error) })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
