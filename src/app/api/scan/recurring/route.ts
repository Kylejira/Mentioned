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

    const { enabled, brandId, brandUrl } = await request.json()

    if (typeof enabled !== "boolean") {
      return NextResponse.json({ error: "Missing enabled field" }, { status: 400 })
    }

    const db = createAdminClient()

    // Find the most recent completed scan for this user's brand
    let scanQuery = db
      .from("scans")
      .select("id, brand_id, saas_profile")
      .not("score", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)

    if (brandId) {
      scanQuery = scanQuery.eq("brand_id", brandId)
    }

    const { data: scans, error: findError } = await scanQuery

    if (findError) {
      logger.error("Failed to query scans", { error: findError.message })
      return NextResponse.json({ error: "Database error" }, { status: 500 })
    }

    // If no scan found by brandId, try matching by URL as fallback
    let target = scans?.[0] || null

    if (!target && brandUrl) {
      const { data: fallbackScans } = await db
        .from("scans")
        .select("id, brand_id, saas_profile")
        .not("score", "is", null)
        .order("created_at", { ascending: false })
        .limit(50)

      target = fallbackScans?.find((s) => {
        const profile = s.saas_profile as Record<string, unknown> | null
        return profile?.website_url === brandUrl
      }) || null
    }

    if (!target) {
      return NextResponse.json({ error: "No completed scan found for this brand" }, { status: 404 })
    }

    // Verify ownership
    if (target.brand_id) {
      const { data: brand } = await db
        .from("brands")
        .select("user_id")
        .eq("id", target.brand_id)
        .single()

      if (brand && brand.user_id !== user.id) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 })
      }
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

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const db = createAdminClient()

    // Find the user's brand
    const { data: brand } = await db
      .from("brands")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle()

    if (!brand) {
      return NextResponse.json({ is_recurring: false })
    }

    // Check if any scan for this brand has recurring enabled
    const { data: scan } = await db
      .from("scans")
      .select("is_recurring, recurring_interval, next_run_at")
      .eq("brand_id", brand.id)
      .eq("is_recurring", true)
      .limit(1)
      .maybeSingle()

    return NextResponse.json({
      is_recurring: scan?.is_recurring || false,
      recurring_interval: scan?.recurring_interval || null,
      next_run_at: scan?.next_run_at || null,
    })
  } catch (err) {
    logger.error("Recurring status check error", { error: String(err) })
    return NextResponse.json({ is_recurring: false })
  }
}
