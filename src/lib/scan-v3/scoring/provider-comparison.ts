import type { SupabaseClient } from "@supabase/supabase-js"
import type { LlmProviderName } from "../detection/types"
import type { ProviderScore } from "./types"
import { SCORING_WEIGHTS } from "./weights"
import { log } from "@/lib/logger"

const logger = log.create("provider-comparison")

export interface ProviderComparisonEntry {
  provider: LlmProviderName
  mention_rate: number
  avg_position: number
  sentiment_avg: number
  total_queries: number
  mentions_count: number
  category_coverage: number
  categories_with_mentions: string[]
  composite_score: number
}

export interface CrossProviderMetrics {
  strongest_provider: LlmProviderName | null
  weakest_provider: LlmProviderName | null
  consistency_score: number
  insights: string[]
}

export interface ProviderComparison {
  providers: ProviderComparisonEntry[]
  cross_provider: CrossProviderMetrics
}

const SENTIMENT_MAP: Record<string, number> = {
  positive: 1,
  neutral: 0,
  negative: -1,
}

function positionScoreToAvgRank(weightedScore: number, hasMentions: boolean): number {
  if (!hasMentions) return 0

  const posEntries = Object.entries(SCORING_WEIGHTS.position)
    .map(([rank, weight]) => ({ rank: Number(rank), weight }))
    .sort((a, b) => b.weight - a.weight)

  for (const { rank, weight } of posEntries) {
    if (weightedScore >= weight - 0.05) return rank
  }
  return posEntries[posEntries.length - 1].rank + 1
}

export async function computeProviderComparison(
  scanId: string,
  supabase: SupabaseClient
): Promise<ProviderComparison> {
  const { data, error } = await supabase
    .from("scans")
    .select("provider_scores, score_breakdown")
    .eq("id", scanId)
    .single()

  const emptyCross: CrossProviderMetrics = {
    strongest_provider: null,
    weakest_provider: null,
    consistency_score: 0,
    insights: [],
  }

  if (error || !data) {
    logger.error("Failed to fetch scan data", { scanId, error: error?.message })
    return { providers: [], cross_provider: emptyCross }
  }

  const scores: ProviderScore[] = data.provider_scores ?? []

  if (scores.length === 0) {
    logger.warn("No provider scores found", { scanId })
    return { providers: [], cross_provider: emptyCross }
  }

  const intentCategories = Object.keys(SCORING_WEIGHTS.intent)

  const providers: ProviderComparisonEntry[] = scores.map((ps) => {
    const sentimentAvg = SENTIMENT_MAP[ps.sentiment] ?? 0

    const avgPosition = positionScoreToAvgRank(
      ps.weighted_position_score,
      ps.mention_count > 0
    )

    const rawComposite =
      SCORING_WEIGHTS.components.mention_rate * ps.mention_rate +
      SCORING_WEIGHTS.components.position * ps.weighted_position_score +
      SCORING_WEIGHTS.components.intent * ps.intent_weighted_score
    const compositeScore = Math.min(100, Math.round(rawComposite * 100))

    const intentCoverage = ps.mention_count > 0 && ps.total_queries > 0
      ? Math.min(1, ps.mention_count / Math.max(1, intentCategories.length))
      : 0

    return {
      provider: ps.provider,
      mention_rate: ps.mention_rate,
      avg_position: avgPosition,
      sentiment_avg: sentimentAvg,
      total_queries: ps.total_queries,
      mentions_count: ps.mention_count,
      category_coverage: Math.round(intentCoverage * 100) / 100,
      categories_with_mentions: [],
      composite_score: compositeScore,
    }
  })

  const cross_provider = computeCrossProviderMetrics(providers)

  logger.info("Provider comparison computed", {
    scanId,
    providerCount: providers.length,
    strongest: cross_provider.strongest_provider,
    weakest: cross_provider.weakest_provider,
    consistency: cross_provider.consistency_score,
    insights: cross_provider.insights,
  })

  return { providers, cross_provider }
}

function computeCrossProviderMetrics(
  providers: ProviderComparisonEntry[]
): CrossProviderMetrics {
  if (providers.length === 0) {
    return { strongest_provider: null, weakest_provider: null, consistency_score: 0, insights: [] }
  }

  const sorted = [...providers].sort((a, b) => b.composite_score - a.composite_score)
  const strongest = sorted[0]
  const weakest = sorted[sorted.length - 1]

  const mentionRates = providers.map((p) => p.mention_rate)
  const maxRate = Math.max(...mentionRates)
  const minRate = Math.min(...mentionRates)
  const spread = maxRate - minRate
  const consistency_score = Math.round((1 - spread) * 100)

  const insights: string[] = []

  if (strongest.composite_score > weakest.composite_score + 10) {
    insights.push(
      `${strongest.provider} outperforms ${weakest.provider} by ${strongest.composite_score - weakest.composite_score} points`
    )
  }

  if (spread > 0.3) {
    insights.push(
      `Large mention rate gap between providers (${Math.round(maxRate * 100)}% vs ${Math.round(minRate * 100)}%)`
    )
  } else if (spread < 0.1 && providers.length > 1) {
    insights.push("Mention rates are consistent across all providers")
  }

  const positiveSentiment = providers.filter((p) => p.sentiment_avg > 0)
  const negativeSentiment = providers.filter((p) => p.sentiment_avg < 0)
  if (positiveSentiment.length > 0 && negativeSentiment.length > 0) {
    insights.push(
      `Mixed sentiment: ${positiveSentiment.map((p) => p.provider).join(", ")} positive vs ${negativeSentiment.map((p) => p.provider).join(", ")} negative`
    )
  }

  const noMentions = providers.filter((p) => p.mentions_count === 0)
  if (noMentions.length > 0 && noMentions.length < providers.length) {
    insights.push(
      `Not mentioned by: ${noMentions.map((p) => p.provider).join(", ")}`
    )
  }

  return {
    strongest_provider: strongest.provider,
    weakest_provider: weakest.provider,
    consistency_score,
    insights: insights.slice(0, 4),
  }
}
