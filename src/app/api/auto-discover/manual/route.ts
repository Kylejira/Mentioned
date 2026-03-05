import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { createAdminClient } from "@/lib/supabase-admin"
import { generateDiscoveryQueries } from "@/lib/auto-discover/query-discovery-generator"
import { filterQueries } from "@/lib/auto-discover/query-quality-filter"
import type { ProductProfile } from "@/lib/auto-discover/website-analyzer"
import { log } from "@/lib/logger"

export const maxDuration = 60
export const dynamic = "force-dynamic"

const logger = log.create("auto-discover-manual")

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

    const productName = body.product_name as string
    const description = body.description as string
    const category = body.category as string
    const competitors = (body.competitors as string[]) || []
    const sourceUrl = (body.source_url as string) || ""

    if (!productName || !description || !category) {
      return NextResponse.json(
        { error: "Missing required fields: product_name, description, category" },
        { status: 400 }
      )
    }

    // Build profile from manual input
    const profile: ProductProfile = {
      product_name: productName,
      category,
      subcategory: category,
      problem_solved: description,
      target_audience: "",
      key_features: [],
      differentiators: [],
      competitors,
      keywords: [],
      pricing_model: "unknown",
      tone: "",
      extraction_confidence: "medium",
      source_url: sourceUrl,
    }

    // Generate queries (LLM call)
    const rawQueries = await generateDiscoveryQueries(profile)
    const filteredQueries = filterQueries(rawQueries, profile)

    // Store session
    const adminDb = createAdminClient()
    const queriesWithState = filteredQueries.map((q) => ({
      ...q,
      selected: true,
      edited: false,
    }))

    const { data: session, error: insertError } = await adminDb
      .from("auto_discovery_sessions")
      .insert({
        user_id: user.id,
        source_url: sourceUrl || `manual://${productName}`,
        product_profile: profile,
        generated_queries: queriesWithState,
        status: "pending",
      })
      .select()
      .single()

    if (insertError || !session) {
      logger.error("Failed to store manual discovery session", {
        error: String(insertError),
      })
      return NextResponse.json(
        { error: "Failed to save discovery session" },
        { status: 500 }
      )
    }

    logger.info("Manual discovery completed", {
      sessionId: session.id,
      product: productName,
      queriesGenerated: filteredQueries.length,
    })

    return NextResponse.json({
      session_id: session.id,
      profile,
      queries: queriesWithState,
    })
  } catch (err) {
    logger.error("Manual discovery failed", {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json(
      { error: "Manual discovery failed. Please try again." },
      { status: 500 }
    )
  }
}
