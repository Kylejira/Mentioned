import { log } from "@/lib/logger"
import type { ResponseAnalysis } from "../detection/types"
import type { IntentCluster } from "../queries/types"

const logger = log.create("content-opportunity-analyzer")

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComparisonOpportunity {
  type: "comparison"
  competitor_name: string
  competitor_mentions: number
  brand_mentions: number
  priority: number
  intent: string
  trigger_queries: string[]
}

export interface AnswerPageOpportunity {
  type: "answer_page"
  query_text: string
  competitors_in_response: string[]
  provider_count: number
  priority: number
  intent: string
}

export interface FaqOpportunity {
  type: "faq"
  weak_category: string
  coverage_rate: number
  missed_queries: string[]
  priority: number
}

export interface PositioningOpportunity {
  type: "positioning"
  priority: number
  gaps: string[]
  competitor_count: number
}

export type ContentOpportunity =
  | ComparisonOpportunity
  | AnswerPageOpportunity
  | FaqOpportunity
  | PositioningOpportunity

export interface ContentOpportunities {
  comparison_pages: ComparisonOpportunity[]
  answer_pages: AnswerPageOpportunity[]
  faq_sets: FaqOpportunity[]
  positioning_briefs: PositioningOpportunity[]
  total_opportunities: number
  computed_at: string
}

// ---------------------------------------------------------------------------
// Priority scoring (spec section 2.2)
// ---------------------------------------------------------------------------

const HIGH_INTENT: Set<string> = new Set(["alternatives", "comparison"])
const MED_INTENT: Set<string> = new Set(["problem_based", "feature_based"])

function computeAnswerPagePriority(
  intent: string,
  competitorCount: number,
  providerCount: number,
  brandMentionedInSimilar: boolean
): number {
  let score = 0

  if (HIGH_INTENT.has(intent)) score += 40
  else if (MED_INTENT.has(intent)) score += 25
  else score += 10

  score += Math.min(30, competitorCount * 6)

  if (providerCount >= 2) score += 20

  if (brandMentionedInSimilar) score += 10

  return Math.min(100, score)
}

// ---------------------------------------------------------------------------
// Source A: Missed queries → Answer page opportunities
// ---------------------------------------------------------------------------

function findMissedQueries(analyses: ResponseAnalysis[]): AnswerPageOpportunity[] {
  const queryMap = new Map<string, {
    intent: IntentCluster
    providers: Set<string>
    competitors: Set<string>
    brandMentioned: boolean
  }>()

  for (const a of analyses) {
    const qText = a.query.text
    let entry = queryMap.get(qText)
    if (!entry) {
      entry = { intent: a.query.intent, providers: new Set(), competitors: new Set(), brandMentioned: false }
      queryMap.set(qText, entry)
    }

    entry.providers.add(a.provider)

    if (a.brand_detection.detected) {
      entry.brandMentioned = true
    }

    for (const cd of a.competitor_detections) {
      if (cd.detected) entry.competitors.add(cd.brand_name)
    }
  }

  const allBrandMentionedQueries = new Set(
    [...queryMap.entries()].filter(([, v]) => v.brandMentioned).map(([k]) => k)
  )

  const opportunities: AnswerPageOpportunity[] = []

  for (const [queryText, entry] of queryMap) {
    if (entry.brandMentioned) continue
    if (entry.competitors.size === 0) continue

    const brandMentionedInSimilar = allBrandMentionedQueries.size > 0

    const priority = computeAnswerPagePriority(
      entry.intent,
      entry.competitors.size,
      entry.providers.size,
      brandMentionedInSimilar
    )

    opportunities.push({
      type: "answer_page",
      query_text: queryText,
      competitors_in_response: [...entry.competitors],
      provider_count: entry.providers.size,
      priority,
      intent: entry.intent,
    })
  }

  return opportunities.sort((a, b) => b.priority - a.priority).slice(0, 15)
}

// ---------------------------------------------------------------------------
// Source B: Competitor dominance → Comparison page opportunities
// ---------------------------------------------------------------------------

function findDominantCompetitors(analyses: ResponseAnalysis[]): ComparisonOpportunity[] {
  const brandMentionCount = analyses.filter((a) => a.brand_detection.detected).length

  const competitorCounts: Record<string, { count: number; queries: Set<string> }> = {}

  for (const a of analyses) {
    for (const cd of a.competitor_detections) {
      if (!cd.detected) continue
      if (!competitorCounts[cd.brand_name]) {
        competitorCounts[cd.brand_name] = { count: 0, queries: new Set() }
      }
      competitorCounts[cd.brand_name].count++
      competitorCounts[cd.brand_name].queries.add(a.query.text)
    }
  }

  const opportunities: ComparisonOpportunity[] = []

  const sorted = Object.entries(competitorCounts)
    .filter(([, v]) => v.count > brandMentionCount * 1.5 || (brandMentionCount === 0 && v.count >= 3))
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 5)

  for (const [name, data] of sorted) {
    const ratio = brandMentionCount > 0 ? data.count / brandMentionCount : data.count
    const priority = Math.min(100, Math.round(40 + Math.min(30, ratio * 5) + Math.min(30, data.queries.size * 3)))

    opportunities.push({
      type: "comparison",
      competitor_name: name,
      competitor_mentions: data.count,
      brand_mentions: brandMentionCount,
      priority,
      intent: "competitor_comparison",
      trigger_queries: [...data.queries].slice(0, 5),
    })
  }

  return opportunities.sort((a, b) => b.priority - a.priority)
}

// ---------------------------------------------------------------------------
// Source C: Category/intent gaps → FAQ opportunities
// ---------------------------------------------------------------------------

function findWeakCategories(analyses: ResponseAnalysis[]): FaqOpportunity[] {
  const intentBuckets = new Map<IntentCluster, { total: number; mentioned: number; queries: string[] }>()

  for (const a of analyses) {
    const intent = a.query.intent
    let bucket = intentBuckets.get(intent)
    if (!bucket) {
      bucket = { total: 0, mentioned: 0, queries: [] }
      intentBuckets.set(intent, bucket)
    }
    bucket.total++
    if (a.brand_detection.detected) bucket.mentioned++
    else bucket.queries.push(a.query.text)
  }

  const opportunities: FaqOpportunity[] = []

  for (const [intent, bucket] of intentBuckets) {
    if (bucket.total < 2) continue
    const rate = bucket.mentioned / bucket.total
    if (rate >= 0.3) continue

    const uniqueQueries = [...new Set(bucket.queries)].slice(0, 5)
    if (uniqueQueries.length === 0) continue

    const priority = Math.min(100, Math.round(
      (1 - rate) * 50 + Math.min(30, uniqueQueries.length * 6) + (HIGH_INTENT.has(intent) ? 20 : 0)
    ))

    opportunities.push({
      type: "faq",
      weak_category: intent,
      coverage_rate: Math.round(rate * 100) / 100,
      missed_queries: uniqueQueries,
      priority,
    })
  }

  return opportunities.sort((a, b) => b.priority - a.priority)
}

// ---------------------------------------------------------------------------
// Positioning brief opportunity
// ---------------------------------------------------------------------------

function buildPositioningOpportunity(
  analyses: ResponseAnalysis[],
  competitorReasons: { competitors?: Array<{ name: string; reasons: unknown[] }> } | null
): PositioningOpportunity | null {
  if (!competitorReasons || !competitorReasons.competitors || competitorReasons.competitors.length === 0) {
    return null
  }

  const competitorsWithReasons = competitorReasons.competitors.filter(
    (c) => c.reasons && c.reasons.length > 0
  )
  if (competitorsWithReasons.length === 0) return null

  const brandMentions = analyses.filter((a) => a.brand_detection.detected).length
  const totalAnalyses = analyses.length
  const mentionRate = totalAnalyses > 0 ? brandMentions / totalAnalyses : 0

  const gaps: string[] = []
  if (mentionRate < 0.3) gaps.push("Low overall mention rate")
  if (mentionRate < 0.1) gaps.push("Near-zero AI visibility")

  const uniqueCategories = new Set<string>()
  for (const c of competitorsWithReasons) {
    for (const r of c.reasons as Array<{ category?: string }>) {
      if (r.category) uniqueCategories.add(r.category)
    }
  }
  if (uniqueCategories.size > 3) gaps.push("Competitors dominate multiple positioning categories")

  if (gaps.length === 0) gaps.push("Competitors have structured positioning that AI models favor")

  const priority = Math.min(100, Math.round(
    50 + Math.min(25, competitorsWithReasons.length * 5) + Math.min(25, gaps.length * 8)
  ))

  return {
    type: "positioning",
    priority,
    gaps,
    competitor_count: competitorsWithReasons.length,
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function identifyContentOpportunities(
  analyses: ResponseAnalysis[],
  competitorReasons: { competitors?: Array<{ name: string; reasons: unknown[] }> } | null
): ContentOpportunities {
  if (!analyses || analyses.length === 0) {
    logger.warn("No analyses provided for content opportunity identification")
    return emptyOpportunities()
  }

  const answerPages = findMissedQueries(analyses)
  const comparisonPages = findDominantCompetitors(analyses)
  const faqSets = findWeakCategories(analyses)
  const positioningBrief = buildPositioningOpportunity(analyses, competitorReasons)

  const positioningBriefs = positioningBrief ? [positioningBrief] : []

  const total = answerPages.length + comparisonPages.length + faqSets.length + positioningBriefs.length

  logger.info("Content opportunities identified", {
    answerPages: answerPages.length,
    comparisonPages: comparisonPages.length,
    faqSets: faqSets.length,
    positioningBriefs: positioningBriefs.length,
    total,
  })

  return {
    comparison_pages: comparisonPages,
    answer_pages: answerPages,
    faq_sets: faqSets,
    positioning_briefs: positioningBriefs,
    total_opportunities: total,
    computed_at: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Empty result
// ---------------------------------------------------------------------------

function emptyOpportunities(): ContentOpportunities {
  return {
    comparison_pages: [],
    answer_pages: [],
    faq_sets: [],
    positioning_briefs: [],
    total_opportunities: 0,
    computed_at: new Date().toISOString(),
  }
}
