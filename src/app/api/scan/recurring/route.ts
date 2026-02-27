import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { createAdminClient } from "@/lib/supabase-admin"
import { log } from "@/lib/logger"

export const dynamic = "force-dynamic"

const logger = log.create("scan-recurring-api")

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const { brandUrl, enabled } = await request.json()

    if (!brandUrl || typeof enabled !== "boolean") {
      return NextResponse.json({ error: "Missing brandUrl or enabled" }, { status: 400 })
    }

    const db = createAdminClient()

    const { data: scan, error: findError } = await db
      .from("scans")
      .select("id")
      .like("id", `%`)
      .not("score", "is", null)
      .order("created_at", { ascending: false })
      .limit(50)

    if (findError) {
      logger.error("Failed to query scans", { error: findError.message })
      return NextResponse.json({ error: "Database error" }, { status: 500 })
    }

    const { data: matchingScan } = await db
      .from("scans")
      .select("id, saas_profile, is_recurring")
      .not("score", "is", null)
      .order("created_at", { ascending: false })
      .limit(50)

    const target = matchingScan?.find((s) => {
      const profile = s.saas_profile as Record<string, unknown> | null
      return profile?.website_url === brandUrl
    })

    if (!target) {
      return NextResponse.json({ error: "No scan found for this brand" }, { status: 404 })
    }

    const updates: Record<string, unknown> = {
      is_recurring: enabled,
      recurring_interval: enabled ? "weekly" : null,
      next_run_at: enabled
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        : null,
    }

    const { error: updateError } = await db
      .from("scans")
      .update(updates)
      .eq("id", target.id)

    if (updateError) {
      logger.error("Failed to update recurring", { scanId: target.id, error: updateError.message })
      return NextResponse.json({ error: "Failed to update" }, { status: 500 })
    }

    logger.info("Recurring scan toggled", { scanId: target.id, enabled })

    return NextResponse.json({
      scanId: target.id,
      is_recurring: enabled,
      recurring_interval: enabled ? "weekly" : null,
      next_run_at: updates.next_run_at,
    })
  } catch (err) {
    logger.error("Recurring toggle error", { error: String(err) })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
