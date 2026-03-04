import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { createAdminClient } from "@/lib/supabase-admin"
import { log } from "@/lib/logger"

export const dynamic = "force-dynamic"

const logger = log.create("scan-queries-api")

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

    const { data: scan, error: scanError } = await db
      .from("scans")
      .select("id, brand_id, saas_profile, summary")
      .eq("id", scanId)
      .single()

    if (scanError || !scan) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 })
    }

    if (!scan.brand_id) {
      return NextResponse.json({ error: "Scan has no associated brand" }, { status: 403 })
    }

    const { data: brand, error: brandError } = await db
      .from("brands")
      .select("user_id")
      .eq("id", scan.brand_id)
      .single()

    if (brandError || !brand || brand.user_id !== user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 })
    }

    // Try to get full result from scan_history (has queries_tested + raw_responses)
    const profileUrl = (scan.saas_profile as Record<string, unknown>)?.website_url as string | undefined
    let fullResult: Record<string, unknown> | null = null

    if (profileUrl) {
      const { data: history } = await db
        .from("scan_history")
        .select("full_result")
        .eq("product_url", profileUrl)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      fullResult = (history?.full_result as Record<string, unknown>) || null
    }

    // Fallback: check scan summary
    if (!fullResult) {
      fullResult = (scan.summary as Record<string, unknown>) || null
    }

    if (!fullResult) {
      return NextResponse.json({
        total: 0,
        results: [],
        filters: { providers: [], categories: [] },
      })
    }

    const queriesTested = (fullResult.queries_tested || fullResult.queries || []) as Array<Record<string, unknown>>
    const rawResponses = (fullResult.raw_responses || []) as Array<Record<string, unknown>>

    if (!Array.isArray(queriesTested) || queriesTested.length === 0) {
      return NextResponse.json({
        total: 0,
        results: [],
        filters: { providers: [], categories: [] },
      })
    }

    // Build a lookup of raw responses by query text
    const responseLookup = new Map<string, Record<string, unknown>>()
    for (const r of rawResponses) {
      if (r.query) responseLookup.set(r.query as string, r)
    }

    // Transform into per-provider results
    const results: Array<Record<string, unknown>> = []
    const providerSet = new Set<string>()

    for (const q of queriesTested) {
      const queryText = (q.query || "") as string
      const raw = responseLookup.get(queryText)

      const providers = [
        { key: "chatgpt", provider: "openai", model: "GPT-4o", label: "ChatGPT" },
        { key: "claude", provider: "anthropic", model: "Claude", label: "Claude" },
        { key: "gemini", provider: "gemini", model: "Gemini", label: "Gemini" },
      ]

      for (const p of providers) {
        const mentioned = q[p.key]
        if (mentioned === undefined && !raw?.[`${p.key}_response`]) continue

        providerSet.add(p.provider)
        results.push({
          id: `${queryText}-${p.provider}`,
          query_text: queryText,
          query_category: (q.category || null) as string | null,
          provider: p.provider,
          model: p.model,
          brand_mentioned: !!mentioned,
          brand_position: null,
          brand_sentiment: null,
          competitors_detected: null,
          response_text: (raw?.[`${p.key}_response`] || null) as string | null,
          latency_ms: null,
          created_at: null,
        })
      }
    }

    const providers = [...providerSet]
    const categories = [...new Set(results.map(r => r.query_category).filter(Boolean))] as string[]

    return NextResponse.json({
      total: results.length,
      results,
      filters: { providers, categories },
    })
  } catch (err) {
    logger.error("Failed to fetch scan queries", { error: String(err) })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
