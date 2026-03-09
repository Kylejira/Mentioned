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

    // Build scan payload
    const queryTexts = selectedQueries.map((q) => q.query)

    // Resolve brandUrl — profile.source_url, session.source_url, or build from product name
    let brandUrl = (profile.source_url as string) || (session.source_url as string) || ""
    if (!brandUrl || brandUrl.startsWith("manual://")) {
      brandUrl = `https://${((profile.product_name as string) || "unknown").toLowerCase().replace(/\s+/g, "")}.com`
    }

    const scanPayload = {
      brandName: (profile.product_name as string) || "Unknown Product",
      brandUrl,
      category: (profile.category as string) || "software",
      coreProblem: (profile.problem_solved as string) || "",
      targetBuyer: (profile.target_audience as string) || "",
      differentiators: ((profile.differentiators as string[]) || []).join(". "),
      competitors: (profile.competitors as string[]) || [],
      buyerQuestions: queryTexts,
    }

    logger.info("Creating scan from auto-discover", {
      sessionId,
      brandName: scanPayload.brandName,
      brandUrl: scanPayload.brandUrl,
      queryCount: queryTexts.length,
    })

    // Forward cookies so the scan route gets the same auth context
    const cookieHeader = request.headers.get("cookie") || ""
    const origin = request.nextUrl.origin

    let scanResult: Record<string, unknown>
    try {
      const scanResponse = await fetch(`${origin}/api/scan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieHeader,
        },
        body: JSON.stringify(scanPayload),
      })

      const responseText = await scanResponse.text()
      try {
        scanResult = JSON.parse(responseText)
      } catch {
        logger.error("Scan API returned non-JSON", { status: scanResponse.status, body: responseText.slice(0, 500) })
        return NextResponse.json(
          { error: "Scan service returned an unexpected response. Please try again." },
          { status: 502 }
        )
      }

      if (!scanResponse.ok) {
        logger.error("Scan creation failed", {
          sessionId,
          status: scanResponse.status,
          error: scanResult.error,
          payload: { brandName: scanPayload.brandName, brandUrl: scanPayload.brandUrl },
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
    } catch (fetchErr) {
      logger.error("Failed to call scan API", {
        sessionId,
        error: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
        origin,
      })
      return NextResponse.json(
        { error: "Failed to reach scan service. Please try again." },
        { status: 502 }
      )
    }

    // Scan route returns scanId (queued mode) or _scanId (sync mode)
    const resolvedScanId = scanResult.scanId || scanResult._scanId || null

    logger.info("Auto-discovery scan created", {
      sessionId,
      scanId: resolvedScanId,
      queriesActivated: queryTexts.length,
      product: profile.product_name,
    })

    return NextResponse.json({
      scan_id: resolvedScanId,
      status: scanResult.status || "complete",
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
