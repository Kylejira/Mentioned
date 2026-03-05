import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { createAdminClient } from "@/lib/supabase-admin"
import { log } from "@/lib/logger"

export const maxDuration = 240
export const dynamic = "force-dynamic"

const logger = log.create("auto-discover-activate")

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
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

    // Create a scan using the existing /api/scan endpoint.
    // We call it internally with the full request context (cookies)
    // so subscription checks, brand creation, and enrichments all happen
    // through the existing pipeline.
    const queryTexts = selectedQueries.map((q) => q.query)

    const scanPayload = {
      brandName: profile.product_name as string,
      brandUrl: profile.source_url as string || (session.source_url as string),
      category: profile.category as string,
      coreProblem: profile.problem_solved as string,
      targetBuyer: profile.target_audience as string,
      differentiators: ((profile.differentiators as string[]) || []).join(". "),
      competitors: (profile.competitors as string[]) || [],
      buyerQuestions: queryTexts,
    }

    // Forward cookies so the scan route gets the same auth context
    const cookieHeader = request.headers.get("cookie") || ""

    const origin = request.nextUrl.origin
    const scanResponse = await fetch(`${origin}/api/scan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify(scanPayload),
    })

    const scanResult = await scanResponse.json()

    if (!scanResponse.ok) {
      logger.error("Scan creation failed", {
        sessionId,
        status: scanResponse.status,
        error: scanResult.error,
      })
      return NextResponse.json(
        {
          error: scanResult.error || "Failed to create scan",
          message: scanResult.message,
          upgradeRequired: scanResult.upgradeRequired,
        },
        { status: scanResponse.status }
      )
    }

    logger.info("Auto-discovery scan created", {
      sessionId,
      scanId: scanResult.scanId,
      queriesActivated: queryTexts.length,
      product: profile.product_name,
    })

    return NextResponse.json({
      scan_id: scanResult.scanId,
      status: scanResult.status || "processing",
      queries_activated: queryTexts.length,
      product_name: profile.product_name,
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
