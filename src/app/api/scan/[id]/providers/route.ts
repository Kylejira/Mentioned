import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { log } from "@/lib/logger"

export const dynamic = "force-dynamic"

const logger = log.create("scan-providers-api")

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

    const { data: scan, error } = await db
      .from("scans")
      .select("summary")
      .eq("id", scanId)
      .single()

    if (error || !scan) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 })
    }

    const summary = scan.summary as Record<string, unknown> | null
    const providerComparison = summary?.provider_comparison ?? null

    if (!providerComparison) {
      return NextResponse.json({
        scanId,
        provider_comparison: null,
        message: "Provider comparison not yet available for this scan",
      })
    }

    return NextResponse.json({
      scanId,
      provider_comparison: providerComparison,
    })
  } catch (err) {
    logger.error("Failed to get provider comparison", { error: String(err) })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
