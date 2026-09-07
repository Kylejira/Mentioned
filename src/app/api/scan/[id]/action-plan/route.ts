import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { createAdminClient } from "@/lib/supabase-admin"
import { log } from "@/lib/logger"

export const dynamic = "force-dynamic"

const logger = log.create("scan-action-plan-api")

// ---------------------------------------------------------------------------
// GET /api/scan/[id]/action-plan — strategic plan actions for a scan
// ---------------------------------------------------------------------------

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

    // Ownership: the scan must belong to a brand this caller owns. Every
    // failure below returns 404 rather than 403 so we never reveal that a
    // scan id exists for someone else.
    const { data: scan, error: scanError } = await db
      .from("scans")
      .select("id, brand_id")
      .eq("id", scanId)
      .single()

    if (scanError || !scan || !scan.brand_id) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 })
    }

    const { data: brand, error: brandError } = await db
      .from("brands")
      .select("user_id")
      .eq("id", scan.brand_id)
      .single()

    if (brandError || !brand || brand.user_id !== user.id) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 })
    }

    const { data: planRow, error: planError } = await db
      .from("action_plans")
      .select("actions, executive_summary")
      .eq("scan_id", scanId)
      .maybeSingle()

    // A scan without a plan is a valid state (free/starter tiers, older
    // scans, or a generation that failed non-fatally) — report it as empty.
    if (planError) {
      logger.warn("Failed to read action plan", { scanId, error: planError.message })
      return NextResponse.json({ actions: [] })
    }

    if (!planRow) {
      return NextResponse.json({ actions: [] })
    }

    return NextResponse.json({
      actions: Array.isArray(planRow.actions) ? planRow.actions : [],
      ...(planRow.executive_summary
        ? { executive_summary: planRow.executive_summary as string }
        : {}),
    })
  } catch (err) {
    logger.error("Failed to fetch action plan", { error: String(err) })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
