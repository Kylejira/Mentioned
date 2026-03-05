import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { createAdminClient } from "@/lib/supabase-admin"
import { fetchWebsiteContent, extractProductProfile } from "@/lib/auto-discover/website-analyzer"
import { generateDiscoveryQueries } from "@/lib/auto-discover/query-discovery-generator"
import { filterQueries } from "@/lib/auto-discover/query-quality-filter"
import { log } from "@/lib/logger"

export const maxDuration = 60
export const dynamic = "force-dynamic"

const logger = log.create("auto-discover-api")

function isValidUrl(url: string): boolean {
  try {
    const normalized = url.startsWith("http") ? url : `https://${url}`
    new URL(normalized)
    return true
  } catch {
    return false
  }
}

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

    const url = body.url as string
    if (!url || !isValidUrl(url)) {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
    }

    const normalizedUrl = url.startsWith("http") ? url : `https://${url}`

    // Step 1: Scrape website
    let websiteText: string
    try {
      websiteText = await fetchWebsiteContent(normalizedUrl)
    } catch (err) {
      logger.warn("Website fetch failed", {
        url: normalizedUrl,
        error: err instanceof Error ? err.message : String(err),
      })
      return NextResponse.json(
        {
          error: "website_fetch_failed",
          message: "Could not load the website. Please describe your product manually.",
          fallback: "manual",
        },
        { status: 422 }
      )
    }

    // Step 2: Check if enough content was extracted
    const strippedText = websiteText
      .replace(/Title:|Description:|Page content:/g, "")
      .trim()
    if (strippedText.length < 100) {
      return NextResponse.json(
        {
          error: "insufficient_content",
          message: "Not enough text found on the page. Please describe your product manually.",
          fallback: "manual",
        },
        { status: 422 }
      )
    }

    // Step 3: Extract product profile (LLM call #1)
    const profile = await extractProductProfile(websiteText, normalizedUrl)

    // Step 4: Check extraction confidence
    if (profile.extraction_confidence === "low") {
      return NextResponse.json({
        error: "low_confidence",
        message: "We extracted some info but are not confident. Please review and edit.",
        profile,
        fallback: "edit_profile",
      })
    }

    // Step 5: Generate queries (LLM call #2)
    const rawQueries = await generateDiscoveryQueries(profile)

    // Step 6: Filter queries (rule-based, no LLM)
    const filteredQueries = filterQueries(rawQueries, profile)

    // Step 7: Store session
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
        source_url: normalizedUrl,
        product_profile: profile,
        generated_queries: queriesWithState,
        status: "pending",
      })
      .select()
      .single()

    if (insertError || !session) {
      logger.error("Failed to store auto-discovery session", {
        error: String(insertError),
      })
      return NextResponse.json(
        { error: "Failed to save discovery session" },
        { status: 500 }
      )
    }

    logger.info("Auto-discovery completed", {
      sessionId: session.id,
      product: profile.product_name,
      queriesGenerated: filteredQueries.length,
    })

    return NextResponse.json({
      session_id: session.id,
      profile,
      queries: queriesWithState,
    })
  } catch (err) {
    logger.error("Auto-discover failed", {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json(
      { error: "Auto-discovery failed. Please try again." },
      { status: 500 }
    )
  }
}
