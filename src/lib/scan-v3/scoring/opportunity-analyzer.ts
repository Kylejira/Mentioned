import type { SupabaseClient } from "@supabase/supabase-js"
import { log } from "@/lib/logger"

const logger = log.create("opportunity-analyzer")

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OpportunityGap = "Low" | "Moderate" | "High" | "Critical"

export interface CompetitorShare {
  name: string
  mentions: number
  share: number
}

export interface OpportunityMetrics {
  total_queries: number
  total_query_provider_pairs: number
  brand_mention_count: number
  competitor_mention_count: number
  queries_with_any_mention: number
  queries_with_no_mention: number
  brand_capture_rate: number
  competitor_capture_rate: number
  shared_capture_rate: number
  uncaptured_rate: number
  opportunity_gap: OpportunityGap
  top_competitors: CompetitorShare[]
  brand_share: number
  insights: string[]
  computed_at: string
}

// ---------------------------------------------------------------------------
// Empty / fallback metrics
// ---------------------------------------------------------------------------

function getEmptyMetrics(): OpportunityMetrics {
  return {
    total_queries: 0,
    total_query_provider_pairs: 0,
    brand_mention_count: 0,
    competitor_mention_count: 0,
    queries_with_any_mention: 0,
    queries_with_no_mention: 0,
    brand_capture_rate: 0,
    competitor_capture_rate: 0,
    shared_capture_rate: 0,
    uncaptured_rate: 0,
    opportunity_gap: "Critical",
    top_competitors: [],
    brand_share: 0,
    insights: ["No scan data available."],
    computed_at: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Opportunity gap classification
// ---------------------------------------------------------------------------

function classifyOpportunityGap(brandCaptureRate: number): OpportunityGap {
  if (brandCaptureRate >= 0.40) return "Low"
  if (brandCaptureRate >= 0.15) return "Moderate"
  if (brandCaptureRate >= 0.05) return "High"
  return "Critical"
}

// ---------------------------------------------------------------------------
// Insight generation (max 4, priority-ordered)
// ---------------------------------------------------------------------------

export function generateOpportunityInsights(
  brandMentionCount: number,
  brandCaptureRate: number,
  competitorCaptureRate: number,
  sharedCaptureRate: number,
  uncapturedRate: number,
  brandShare: number,
  topCompetitors: CompetitorShare[],
  totalQueryProviderPairs: number
): string[] {
  const insights: string[] = []
  const pct = (v: number) => Math.round(v * 100)

  // Priority 1: Competitor dominance OR brand strength
  if (competitorCaptureRate > 0.5) {
    insights.push(
      `Competitors capture ${pct(competitorCaptureRate)}% of AI recommendations in your category. Your brand captures ${pct(brandCaptureRate)}%.`
    )
  } else if (brandCaptureRate > 0.3) {
    insights.push(
      `You capture ${pct(brandCaptureRate)}% of AI recommendations. Strong position — focus on maintaining and expanding.`
    )
  }

  // Priority 2: Top competitor outsizes brand
  if (topCompetitors.length > 0 && brandShare > 0) {
    const top = topCompetitors[0]
    if (top.share > brandShare * 2) {
      const multiplier = Math.round(top.mentions / Math.max(1, brandMentionCount))
      insights.push(
        `${top.name} is mentioned ${multiplier}x more often than your brand. They capture ${pct(top.share)}% of all AI recommendations.`
      )
    }
  }

  // Priority 3: Uncaptured demand
  if (uncapturedRate > 0.15) {
    insights.push(
      `${pct(uncapturedRate)}% of buyer queries had no product recommendation. AI models don't know enough about your category to recommend anyone.`
    )
  }

  // Priority 4: Zero brand mentions
  if (brandMentionCount === 0) {
    insights.push(
      `Your brand was not mentioned in any of the ${totalQueryProviderPairs} buyer queries tested. Competitors capture 100% of AI recommendation demand.`
    )
  }

  // Priority 5: Shared capture (appears alongside competitors)
  if (sharedCaptureRate > 0.3 && insights.length < 4) {
    insights.push(
      `You appear alongside competitors in ${pct(sharedCaptureRate)}% of recommendations. Focus on improving your ranking position.`
    )
  }

  // If fewer than 2 insights, add maintenance message
  if (insights.length < 2) {
    insights.push(
      "Your AI visibility is strong. Monitor competitor activity and continue optimizing content to maintain your position."
    )
  }

  return insights.slice(0, 4)
}

// ---------------------------------------------------------------------------
// Main computation
// ---------------------------------------------------------------------------

export async function computeOpportunityMetrics(
  scanId: string,
  supabase: SupabaseClient
): Promise<OpportunityMetrics> {
  const { data: results, error } = await supabase
    .from("scan_results")
    .select("query_text, provider, brand_mentioned, competitors_detected")
    .eq("scan_id", scanId)

  if (error) {
    logger.error("Failed to fetch scan_results", { scanId, error: error.message })
    return getEmptyMetrics()
  }

  if (!results || results.length === 0) {
    logger.warn("No scan_results rows for scan", { scanId })
    return getEmptyMetrics()
  }

  const totalPairs = results.length
  const uniqueQueries = new Set(results.map((r) => r.query_text)).size

  // --- Brand mentions ---
  const brandMentionCount = results.filter((r) => r.brand_mentioned).length

  // --- Competitor mentions & per-competitor tallies ---
  const competitorCounts: Record<string, number> = {}
  let totalCompetitorMentionInstances = 0

  for (const r of results) {
    const comps: unknown[] = r.competitors_detected || []
    for (const c of comps) {
      const name = typeof c === "string" ? c : (c as { name?: string })?.name
      if (!name) continue
      competitorCounts[name] = (competitorCounts[name] || 0) + 1
      totalCompetitorMentionInstances++
    }
  }

  // --- Classify each result row ---
  let anyMention = 0
  let competitorOnly = 0
  let shared = 0
  let noMention = 0

  for (const r of results) {
    const hasBrand = r.brand_mentioned === true
    const hasComp = (r.competitors_detected || []).length > 0

    if (hasBrand || hasComp) {
      anyMention++
      if (hasBrand && hasComp) shared++
      else if (!hasBrand && hasComp) competitorOnly++
    } else {
      noMention++
    }
  }

  // --- Rates ---
  const brandCaptureRate = anyMention > 0 ? brandMentionCount / anyMention : 0
  const competitorCaptureRate = anyMention > 0 ? competitorOnly / anyMention : 0
  const sharedCaptureRate = anyMention > 0 ? shared / anyMention : 0
  const uncapturedRate = totalPairs > 0 ? noMention / totalPairs : 0

  // --- Opportunity gap ---
  const opportunityGap = classifyOpportunityGap(brandCaptureRate)

  // --- Per-competitor share ---
  const totalRecMentions = brandMentionCount + totalCompetitorMentionInstances
  const brandShare = totalRecMentions > 0 ? brandMentionCount / totalRecMentions : 0

  const topCompetitors: CompetitorShare[] = Object.entries(competitorCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, mentions]) => ({
      name,
      mentions,
      share: totalRecMentions > 0 ? mentions / totalRecMentions : 0,
    }))

  // --- Insights ---
  const insights = generateOpportunityInsights(
    brandMentionCount,
    brandCaptureRate,
    competitorCaptureRate,
    sharedCaptureRate,
    uncapturedRate,
    brandShare,
    topCompetitors,
    totalPairs
  )

  const metrics: OpportunityMetrics = {
    total_queries: uniqueQueries,
    total_query_provider_pairs: totalPairs,
    brand_mention_count: brandMentionCount,
    competitor_mention_count: totalCompetitorMentionInstances,
    queries_with_any_mention: anyMention,
    queries_with_no_mention: noMention,
    brand_capture_rate: Math.round(brandCaptureRate * 1000) / 1000,
    competitor_capture_rate: Math.round(competitorCaptureRate * 1000) / 1000,
    shared_capture_rate: Math.round(sharedCaptureRate * 1000) / 1000,
    uncaptured_rate: Math.round(uncapturedRate * 1000) / 1000,
    opportunity_gap: opportunityGap,
    top_competitors: topCompetitors.map((c) => ({
      ...c,
      share: Math.round(c.share * 1000) / 1000,
    })),
    brand_share: Math.round(brandShare * 1000) / 1000,
    insights,
    computed_at: new Date().toISOString(),
  }

  logger.info("Opportunity metrics computed", {
    scanId,
    totalPairs,
    brandMentions: brandMentionCount,
    competitorMentions: totalCompetitorMentionInstances,
    brandCaptureRate: metrics.brand_capture_rate,
    opportunityGap,
  })

  return metrics
}
