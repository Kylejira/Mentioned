import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { log } from "@/lib/logger"

export const dynamic = "force-dynamic"

const logger = log.create("conversations-api")

const VALID_SORT_FIELDS = ["opportunity_score", "posted_at", "created_at"] as const
const VALID_TIERS = ["hot", "strong", "moderate", "low", "cold"] as const

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const params = request.nextUrl.searchParams

    // Sort
    const sortBy = params.get("sort") || "opportunity_score"
    const sortDir = params.get("dir") === "asc" ? true : false
    const validSort = VALID_SORT_FIELDS.includes(sortBy as any) ? sortBy : "opportunity_score"

    // Tier filter
    const tierParam = params.get("tiers")
    const tiers = tierParam
      ? tierParam.split(",").filter((t) => VALID_TIERS.includes(t as any))
      : null

    // Pagination
    const limit = Math.min(parseInt(params.get("limit") || "50", 10), 200)
    const offset = parseInt(params.get("offset") || "0", 10)

    let query = supabase
      .from("conversations")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order(validSort, { ascending: sortDir })
      .range(offset, offset + limit - 1)

    if (tiers && tiers.length > 0) {
      query = query.in("opportunity_tier", tiers)
    }

    const { data: conversations, count, error } = await query

    if (error) {
      logger.error("Failed to fetch conversations", { error: error.message })
      return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 })
    }

    // Tier counts for filter chips (always unfiltered)
    const { data: tierCounts } = await supabase
      .rpc("count_conversation_tiers", { p_user_id: user.id })

    // Fallback if RPC doesn't exist yet: count per tier manually
    let counts: Record<string, number> = { hot: 0, strong: 0, moderate: 0, low: 0, cold: 0 }
    if (tierCounts && Array.isArray(tierCounts)) {
      for (const row of tierCounts) {
        counts[row.tier] = row.count
      }
    } else {
      // Manual count fallback
      for (const tier of VALID_TIERS) {
        const { count: c } = await supabase
          .from("conversations")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("opportunity_tier", tier)
        counts[tier] = c || 0
      }
    }

    return NextResponse.json({
      conversations: conversations || [],
      total: count || 0,
      tier_counts: counts,
      sort: validSort,
      offset,
      limit,
    })
  } catch (err) {
    logger.error("Conversations API error", {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
