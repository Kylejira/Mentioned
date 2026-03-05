import type { SupabaseClient } from "@supabase/supabase-js"
import pLimit from "p-limit"
import { log } from "@/lib/logger"

const logger = log.create("competitor-reason-analyzer")

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReasonCategory =
  | "pricing"
  | "ease_of_use"
  | "performance"
  | "features"
  | "integrations"
  | "enterprise"
  | "community"
  | "documentation"
  | "open_source"
  | "customization"
  | "security"
  | "support"
  | "scalability"
  | "design"
  | "reliability"

export interface ExtractedReason {
  reason: string
  category: ReasonCategory
  frequency: number
  sample_quote: string
}

export interface CompetitorReasonEntry {
  name: string
  total_mentions: number
  reasons: ExtractedReason[]
  top_categories: ReasonCategory[]
  positioning_summary: string
}

export interface CategoryLeader {
  category: ReasonCategory
  leader: string
  frequency: number
}

export interface OverflowCompetitor {
  name: string
  total_mentions: number
}

export interface CompetitorReasonAnalysis {
  competitors: CompetitorReasonEntry[]
  category_leaders: CategoryLeader[]
  insights: string[]
  overflow_competitors: OverflowCompetitor[]
  computed_at: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_CATEGORIES: Set<string> = new Set([
  "pricing", "ease_of_use", "performance", "features", "integrations",
  "enterprise", "community", "documentation", "open_source", "customization",
  "security", "support", "scalability", "design", "reliability",
])

const SYNONYM_MAP: Record<string, ReasonCategory> = {
  cheap: "pricing",
  affordable: "pricing",
  "low cost": "pricing",
  free: "pricing",
  budget: "pricing",
  simple: "ease_of_use",
  intuitive: "ease_of_use",
  easy: "ease_of_use",
  beginner: "ease_of_use",
  "user-friendly": "ease_of_use",
  fast: "performance",
  quick: "performance",
  responsive: "performance",
  api: "integrations",
  webhook: "integrations",
  plugin: "integrations",
  soc: "enterprise",
  compliance: "enterprise",
  sso: "enterprise",
  gdpr: "security",
  encrypted: "security",
  privacy: "security",
}

const MAX_COMPETITORS = 8
const MAX_CONTEXTS_PER_COMPETITOR = 20
const LLM_CONCURRENCY = 3
const MIN_RESPONSE_LENGTH = 50

// ---------------------------------------------------------------------------
// Context extraction (pure string operations, no LLM)
// ---------------------------------------------------------------------------

export function extractCompetitorContext(
  responseText: string,
  competitorName: string
): string[] {
  if (!responseText || !competitorName) return []

  const sentences = responseText.split(/(?<=[.!?])\s+/)
  const nameLower = competitorName.toLowerCase()
  const contexts: string[] = []

  sentences.forEach((sentence, i) => {
    if (sentence.toLowerCase().includes(nameLower)) {
      const start = Math.max(0, i - 1)
      const end = Math.min(sentences.length, i + 2)
      const context = sentences.slice(start, end).join(" ").trim()
      if (context.length > 10) {
        contexts.push(context)
      }
    }
  })

  return contexts
}

// ---------------------------------------------------------------------------
// Context deduplication
// ---------------------------------------------------------------------------

function deduplicateContexts(contexts: string[]): string[] {
  const seen = new Set<string>()
  const unique: string[] = []

  for (const ctx of contexts) {
    const normalized = ctx.toLowerCase().replace(/\s+/g, " ").trim()
    if (!seen.has(normalized)) {
      seen.add(normalized)
      unique.push(ctx)
    }
  }

  return unique
}

// ---------------------------------------------------------------------------
// Reason deduplication (merge >80% word overlap)
// ---------------------------------------------------------------------------

function wordOverlap(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/))
  const wordsB = new Set(b.toLowerCase().split(/\s+/))
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length
  const union = new Set([...wordsA, ...wordsB]).size
  return union > 0 ? intersection / union : 0
}

function deduplicateReasons(reasons: ExtractedReason[]): ExtractedReason[] {
  const merged: ExtractedReason[] = []

  for (const r of reasons) {
    const existing = merged.find((m) => wordOverlap(m.reason, r.reason) > 0.8)
    if (existing) {
      if (r.frequency > existing.frequency) {
        existing.reason = r.reason
        existing.sample_quote = r.sample_quote
      }
      existing.frequency += r.frequency
    } else {
      merged.push({ ...r })
    }
  }

  return merged.sort((a, b) => b.frequency - a.frequency)
}

// ---------------------------------------------------------------------------
// Category normalization via synonym fallback
// ---------------------------------------------------------------------------

function normalizeCategory(category: string, reasonText: string): ReasonCategory {
  const slug = category.toLowerCase().trim()
  if (VALID_CATEGORIES.has(slug)) return slug as ReasonCategory

  const reasonLower = reasonText.toLowerCase()
  for (const [keyword, cat] of Object.entries(SYNONYM_MAP)) {
    if (reasonLower.includes(keyword)) return cat
  }

  return "features"
}

// ---------------------------------------------------------------------------
// LLM reason extraction (one call per competitor)
// ---------------------------------------------------------------------------

export async function extractReasonsWithLLM(
  competitorName: string,
  contexts: string[],
  llmCall: (prompt: string) => Promise<string>
): Promise<ExtractedReason[]> {
  if (contexts.length === 0) return []

  const deduplicated = deduplicateContexts(contexts)
  const capped = deduplicated.slice(0, MAX_CONTEXTS_PER_COMPETITOR)

  const prompt = `You are analyzing AI assistant responses to understand why a competitor is being recommended to users.

Competitor: ${competitorName}

Below are excerpts from AI responses where this competitor was mentioned.
Extract the SPECIFIC REASONS the AI gives for recommending this competitor.

RULES:
1. Only extract reasons that are EXPLICITLY stated in the text below.
2. Do NOT invent or assume reasons not present in the excerpts.
3. Each reason should be a short phrase (2-6 words).
4. Group similar phrases into one reason (e.g., "cheap" and "affordable" = "Affordable pricing").
5. Include a representative quote for each reason (exact text from the excerpts).
6. Assign each reason to ONE category from this list:
   pricing, ease_of_use, performance, features, integrations,
   enterprise, community, documentation, open_source, customization,
   security, support, scalability, design, reliability
7. Set frequency to the number of excerpts that mention this reason.
8. Return at most 8 reasons, ranked by frequency.

EXCERPTS:
${capped.join("\n---\n")}

Respond ONLY with JSON in this exact format:
{
  "reasons": [
    {
      "reason": "Affordable pricing",
      "category": "pricing",
      "frequency": 4,
      "sample_quote": "X is recommended for its affordable pricing..."
    }
  ]
}`

  try {
    const raw = await llmCall(prompt)

    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      logger.warn("No JSON found in LLM response for competitor", { competitorName })
      return []
    }

    const parsed = JSON.parse(jsonMatch[0])
    const reasons: ExtractedReason[] = (parsed.reasons || [])
      .filter(
        (r: any) =>
          r.reason &&
          typeof r.reason === "string" &&
          r.reason.length > 0
      )
      .map((r: any) => ({
        reason: String(r.reason).slice(0, 100),
        category: normalizeCategory(String(r.category || "features"), String(r.reason)),
        frequency: Math.max(1, Number(r.frequency) || 1),
        sample_quote: String(r.sample_quote || "").slice(0, 300),
      }))

    return deduplicateReasons(reasons).slice(0, 8)
  } catch (err) {
    logger.error("LLM reason extraction failed", {
      competitorName,
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}

// ---------------------------------------------------------------------------
// Helpers: top categories, category leaders, summaries, insights
// ---------------------------------------------------------------------------

function getTopCategories(reasons: ExtractedReason[]): ReasonCategory[] {
  const freq: Record<string, number> = {}
  for (const r of reasons) {
    freq[r.category] = (freq[r.category] || 0) + r.frequency
  }
  return Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([cat]) => cat as ReasonCategory)
}

export function computeCategoryLeaders(
  competitors: CompetitorReasonEntry[]
): CategoryLeader[] {
  const best: Record<string, { leader: string; freq: number }> = {}

  for (const comp of competitors) {
    for (const r of comp.reasons) {
      const current = best[r.category]
      if (!current || r.frequency > current.freq) {
        best[r.category] = { leader: comp.name, freq: r.frequency }
      }
    }
  }

  return Object.entries(best)
    .map(([category, { leader, freq }]) => ({
      category: category as ReasonCategory,
      leader,
      frequency: freq,
    }))
    .sort((a, b) => b.frequency - a.frequency)
}

function generatePositioningSummary(
  competitorName: string,
  reasons: ExtractedReason[],
  totalMentions: number
): string {
  if (reasons.length === 0) {
    return `${competitorName} is mentioned ${totalMentions} times but AI doesn't cite specific reasons. Their visibility may be brand-driven rather than feature-driven.`
  }

  const topCategories = getTopCategories(reasons)
    .map((c) => c.replace(/_/g, " "))
    .join(", ")

  const topReason = reasons[0]
  return `AI models position ${competitorName} as strong in ${topCategories}, particularly for "${topReason.reason.toLowerCase()}".`
}

export function generateReasonInsights(
  competitors: CompetitorReasonEntry[],
  categoryLeaders: CategoryLeader[]
): string[] {
  const insights: string[] = []

  // Priority 1: Dominant reason for top competitor
  if (competitors.length > 0) {
    const top = competitors[0]
    if (top.reasons.length >= 2) {
      const first = top.reasons[0]
      const second = top.reasons[1]
      if (first.frequency > second.frequency * 2) {
        insights.push(
          `${top.name} dominates on ${first.category.replace(/_/g, " ")} — AI frequently cites "${first.reason}".`
        )
      }
    }
  }

  // Priority 2: Unclaimed categories
  const claimedCategories = new Set(categoryLeaders.map((l) => l.category))
  const highValueUnclaimed = (
    ["pricing", "ease_of_use", "features", "integrations", "performance"] as ReasonCategory[]
  ).filter((c) => !claimedCategories.has(c))

  if (highValueUnclaimed.length > 0) {
    insights.push(
      `No competitor is strongly associated with ${highValueUnclaimed[0].replace(/_/g, " ")}. This is a positioning gap you could fill.`
    )
  }

  // Priority 4: Common theme across multiple competitors
  const reasonCounts: Record<string, number> = {}
  for (const comp of competitors) {
    const seen = new Set<string>()
    for (const r of comp.reasons) {
      const key = r.category
      if (!seen.has(key)) {
        reasonCounts[key] = (reasonCounts[key] || 0) + 1
        seen.add(key)
      }
    }
  }
  const commonThemes = Object.entries(reasonCounts)
    .filter(([, count]) => count >= 3)
    .sort(([, a], [, b]) => b - a)

  if (commonThemes.length > 0 && insights.length < 4) {
    const [theme, count] = commonThemes[0]
    insights.push(
      `"${theme.replace(/_/g, " ")}" is a common theme — ${count} competitors are recommended for it. Standing out requires a different angle.`
    )
  }

  // Priority 5: Competitor mentioned but no reasons
  for (const comp of competitors) {
    if (comp.reasons.length === 0 && comp.total_mentions > 0 && insights.length < 4) {
      insights.push(
        `${comp.name} is mentioned ${comp.total_mentions} times but AI doesn't cite specific reasons. Their visibility may be brand-driven rather than feature-driven.`
      )
      break
    }
  }

  // Fill if too few
  if (insights.length < 2 && competitors.length > 0) {
    const allCategories = categoryLeaders.map((l) => l.category.replace(/_/g, " "))
    if (allCategories.length > 0) {
      insights.push(
        `AI models most value ${allCategories.slice(0, 3).join(", ")} when recommending tools in your category.`
      )
    }
  }

  return insights.slice(0, 4)
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function analyzeCompetitorReasons(
  scanId: string,
  supabase: SupabaseClient,
  llmCall: (prompt: string) => Promise<string>
): Promise<CompetitorReasonAnalysis> {
  const empty: CompetitorReasonAnalysis = {
    competitors: [],
    category_leaders: [],
    insights: [],
    overflow_competitors: [],
    computed_at: new Date().toISOString(),
  }

  // 1. Fetch responses with competitor detections
  const { data: results, error } = await supabase
    .from("scan_results")
    .select("response_text, competitors_detected")
    .eq("scan_id", scanId)
    .not("competitors_detected", "is", null)

  if (error) {
    logger.error("Failed to fetch scan_results", { scanId, error: error.message })
    return empty
  }

  const competitorResponses = (results || []).filter(
    (r) =>
      r.competitors_detected &&
      Array.isArray(r.competitors_detected) &&
      r.competitors_detected.length > 0
  )

  if (competitorResponses.length === 0) {
    logger.info("No competitor responses found", { scanId })
    return empty
  }

  // 2. Count mentions (all responses) and collect context (long responses only)
  const contextsByCompetitor: Record<string, string[]> = {}
  const mentionCounts: Record<string, number> = {}

  for (const result of competitorResponses) {
    const responseText = result.response_text || ""

    for (const comp of result.competitors_detected) {
      const name = typeof comp === "string" ? comp : (comp as { name?: string })?.name
      if (!name) continue

      mentionCounts[name] = (mentionCounts[name] || 0) + 1

      if (responseText.length >= MIN_RESPONSE_LENGTH) {
        if (!contextsByCompetitor[name]) contextsByCompetitor[name] = []
        const contexts = extractCompetitorContext(responseText, name)
        contextsByCompetitor[name].push(...contexts)
      }
    }
  }

  // 3. Rank by mention count; top N get full analysis, rest become overflow
  const allRanked = Object.entries(mentionCounts)
    .sort(([, a], [, b]) => b - a)

  const rankedCompetitors = allRanked.slice(0, MAX_COMPETITORS)
  const overflowCompetitors: OverflowCompetitor[] = allRanked
    .slice(MAX_COMPETITORS)
    .map(([name, total_mentions]) => ({ name, total_mentions }))

  // 4. Extract reasons with LLM (concurrent, capped)
  const limit = pLimit(LLM_CONCURRENCY)

  const entries: CompetitorReasonEntry[] = await Promise.all(
    rankedCompetitors.map(([name, totalMentions]) =>
      limit(async () => {
        const contexts = contextsByCompetitor[name] || []
        const reasons = await extractReasonsWithLLM(name, contexts, llmCall)

        return {
          name,
          total_mentions: totalMentions,
          reasons,
          top_categories: getTopCategories(reasons),
          positioning_summary: generatePositioningSummary(name, reasons, totalMentions),
        }
      })
    )
  )

  // 5. Compute cross-competitor analysis
  const categoryLeaders = computeCategoryLeaders(entries)
  const insights = generateReasonInsights(entries, categoryLeaders)

  const analysis: CompetitorReasonAnalysis = {
    competitors: entries,
    category_leaders: categoryLeaders,
    insights,
    overflow_competitors: overflowCompetitors,
    computed_at: new Date().toISOString(),
  }

  logger.info("Competitor reason analysis complete", {
    scanId,
    competitorCount: entries.length,
    totalReasons: entries.reduce((s, e) => s + e.reasons.length, 0),
    categoryLeaderCount: categoryLeaders.length,
  })

  return analysis
}
