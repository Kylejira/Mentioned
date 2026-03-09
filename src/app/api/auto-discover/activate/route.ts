import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { createAdminClient } from "@/lib/supabase-admin"
import { log } from "@/lib/logger"

export const dynamic = "force-dynamic"

const logger = log.create("auto-discover-activate")

/**
 * POST /api/auto-discover/activate
 *
 * Saves the user's selected queries and returns a scan payload.
 * The actual scan is triggered client-side by the modal calling /api/scan directly,
 * mirroring the flow used by the /check page.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const sessionId = body.session_id as string
    const selectedQueries = body.selected_queries as Array<{
      query: string
      intent: string
      platform_fit: string
    }>

    if (!sessionId || !Array.isArray(selectedQueries) || selectedQueries.length === 0) {
      return NextResponse.json(
        { error: "Missing session_id or selected_queries" },
        { status: 400 }
      )
    }

    // Fetch session (verify ownership)
    const adminDb = createAdminClient()
    const { data: session, error: fetchError } = await adminDb
      .from("auto_discovery_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single()

    if (fetchError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const profile = session.product_profile as Record<string, unknown>

    // Update session with user selections
    await adminDb
      .from("auto_discovery_sessions")
      .update({
        selected_queries: selectedQueries,
        status: "activated",
      })
      .eq("id", sessionId)

    // Build scan payload for the client to use
    const queryTexts = selectedQueries.map((q) => q.query)

    let brandUrl = (profile.source_url as string) || (session.source_url as string) || ""
    if (!brandUrl || brandUrl.startsWith("manual://")) {
      brandUrl = `https://${((profile.product_name as string) || "unknown").toLowerCase().replace(/\s+/g, "")}.com`
    }

    // Look up the user's brand ID so the scan is linked properly
    let brandId: string | null = null
    try {
      const { data: brand } = await supabase
        .from("brands")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle()

      if (brand) {
        brandId = brand.id
      }
    } catch {
      // Non-fatal
    }

    const scanPayload = {
      brandId,
      brandName: (profile.product_name as string) || "Unknown Product",
      brandUrl,
      category: (profile.category as string) || "software",
      coreProblem: (profile.problem_solved as string) || "",
      targetBuyer: (profile.target_audience as string) || "",
      differentiators: ((profile.differentiators as string[]) || []).join(". "),
      competitors: (profile.competitors as string[]) || [],
      buyerQuestions: queryTexts,
    }

    logger.info("Auto-discover activated, returning scan payload", {
      sessionId,
      brandName: scanPayload.brandName,
      brandUrl: scanPayload.brandUrl,
      brandId,
      queryCount: queryTexts.length,
    })

    return NextResponse.json({
      status: "ready",
      scan_payload: scanPayload,
    })
  } catch (err) {
    logger.error("Activate failed", {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json(
      { error: "Failed to activate queries. Please try again." },
      { status: 500 }
    )
  }
}
