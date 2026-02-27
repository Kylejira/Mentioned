import type { ScoringInput, ScoringBreakdown, ProviderScore } from "./types"
import type { ResponseAnalysis, LlmProviderName } from "../detection/types"
import { SCORING_WEIGHTS } from "./weights"

export class ScoringEngine {
  private getProviderWeight(provider: LlmProviderName): number {
    return SCORING_WEIGHTS.providers[provider] ?? 1.0
  }

  score(input: ScoringInput): ScoringBreakdown {
    const { analyses, total_queries } = input

    if (total_queries === 0) return this.emptyScore()

    // 1. Mention rate (provider-weighted)
    let weightedMentions = 0
    let weightedTotal = 0
    for (const a of analyses) {
      const w = this.getProviderWeight(a.provider)
      weightedTotal += w
      if (a.brand_detection.detected) weightedMentions += w
    }
    const mention_rate = weightedTotal > 0 ? weightedMentions / weightedTotal : 0

    // 2. Position-weighted score (provider-weighted)
    let positionSum = 0
    let positionWeightSum = 0
    const mentions = analyses.filter((a) => a.brand_detection.detected)
    for (const a of mentions) {
      const pos = a.brand_detection.position
      if (pos !== null && pos >= 1) {
        const pw = SCORING_WEIGHTS.position[Math.min(pos, 4)] ?? 0.3
        const providerW = this.getProviderWeight(a.provider)
        positionSum += pw * providerW
        positionWeightSum += providerW
      }
    }
    const weighted_position_score =
      positionWeightSum > 0 ? positionSum / positionWeightSum : mention_rate * 0.5

    // 3. Intent-weighted score (provider-weighted)
    let intentSum = 0
    let intentWeightSum = 0
    for (const a of analyses) {
      const iw = SCORING_WEIGHTS.intent[a.query.intent] ?? 1.0
      const providerW = this.getProviderWeight(a.provider)
      const combined = iw * providerW
      intentWeightSum += combined
      if (a.brand_detection.detected) intentSum += combined
    }
    const intent_weighted_score =
      intentWeightSum > 0 ? intentSum / intentWeightSum : mention_rate

    // 4. Cross-model consistency — pairwise agreement across all active providers
    const cross_model_consistency = this.computeCrossModelConsistency(analyses)

    // 5. Competitor density factor
    const totalCompetitorMentions = analyses.reduce(
      (sum, a) => sum + a.competitor_detections.filter((c) => c.detected).length,
      0
    )
    const avgCompetitors =
      analyses.length > 0 ? totalCompetitorMentions / analyses.length : 0
    const competitor_density_factor = Math.max(0.85, 1.0 - avgCompetitors * 0.03)

    // Combine
    const raw_score =
      SCORING_WEIGHTS.components.mention_rate * mention_rate +
      SCORING_WEIGHTS.components.position * weighted_position_score +
      SCORING_WEIGHTS.components.intent * intent_weighted_score

    const adjusted = raw_score * cross_model_consistency * competitor_density_factor
    const final_score = Math.min(100, Math.round(adjusted * 100))

    // 6. Per-provider scores (unweighted — show true per-provider performance)
    const provider_scores = this.computeProviderScores(analyses)

    return {
      mention_rate,
      weighted_position_score,
      intent_weighted_score,
      cross_model_consistency,
      competitor_density_factor,
      raw_score,
      final_score,
      provider_scores,
    }
  }

  private computeProviderScores(analyses: ResponseAnalysis[]): ProviderScore[] {
    const providerNames = [...new Set(analyses.map((a) => a.provider))]

    return providerNames.map((provider) => {
      const providerAnalyses = analyses.filter((a) => a.provider === provider)
      const providerMentions = providerAnalyses.filter((a) => a.brand_detection.detected)

      const mentionRate = providerAnalyses.length > 0
        ? providerMentions.length / providerAnalyses.length
        : 0

      // Position-weighted score for this provider
      let posSum = 0
      let posCount = 0
      for (const a of providerMentions) {
        const pos = a.brand_detection.position
        if (pos !== null && pos >= 1) {
          posSum += SCORING_WEIGHTS.position[Math.min(pos, 4)] ?? 0.3
          posCount++
        }
      }
      const positionScore = posCount > 0 ? posSum / posCount : mentionRate * 0.5

      // Intent-weighted score for this provider
      let iSum = 0
      let iWeightSum = 0
      for (const a of providerAnalyses) {
        const iw = SCORING_WEIGHTS.intent[a.query.intent] ?? 1.0
        iWeightSum += iw
        if (a.brand_detection.detected) iSum += iw
      }
      const intentScore = iWeightSum > 0 ? iSum / iWeightSum : mentionRate

      // Sentiment: derived from mention rate and position
      const sentiment = this.deriveSentiment(mentionRate, positionScore)

      // Visibility score per provider (same formula as aggregate, without cross-model)
      const rawProviderScore =
        SCORING_WEIGHTS.components.mention_rate * mentionRate +
        SCORING_WEIGHTS.components.position * positionScore +
        SCORING_WEIGHTS.components.intent * intentScore
      const visibilityScore = Math.min(100, Math.round(rawProviderScore * 100))

      return {
        provider,
        mention_rate: mentionRate,
        mention_count: providerMentions.length,
        total_queries: providerAnalyses.length,
        weighted_position_score: positionScore,
        intent_weighted_score: intentScore,
        sentiment,
        visibility_score: visibilityScore,
      }
    })
  }

  private deriveSentiment(mentionRate: number, positionScore: number): "positive" | "neutral" | "negative" {
    if (mentionRate >= 0.5 && positionScore >= 0.4) return "positive"
    if (mentionRate >= 0.2) return "neutral"
    return "negative"
  }

  private computeCrossModelConsistency(analyses: ResponseAnalysis[]): number {
    const providerNames = [...new Set(analyses.map((a) => a.provider))]
    if (providerNames.length < 2) return 1.0

    // Build per-query detection map for each provider
    const queryMap = new Map<string, Map<LlmProviderName, boolean>>()
    for (const a of analyses) {
      const key = a.query.text
      if (!queryMap.has(key)) queryMap.set(key, new Map())
      queryMap.get(key)!.set(a.provider, a.brand_detection.detected)
    }

    // Count pairwise agreements across all provider pairs
    let totalAgreements = 0
    let totalPairs = 0

    for (const [, detections] of queryMap) {
      const present = providerNames.filter((p) => detections.has(p))
      if (present.length < 2) continue

      for (let i = 0; i < present.length; i++) {
        for (let j = i + 1; j < present.length; j++) {
          totalPairs++
          if (detections.get(present[i]) === detections.get(present[j])) {
            totalAgreements++
          }
        }
      }
    }

    return totalPairs > 0 ? 0.6 + 0.4 * (totalAgreements / totalPairs) : 1.0
  }

  private emptyScore(): ScoringBreakdown {
    return {
      mention_rate: 0,
      weighted_position_score: 0,
      intent_weighted_score: 0,
      cross_model_consistency: 1,
      competitor_density_factor: 1,
      raw_score: 0,
      final_score: 0,
      provider_scores: [],
    }
  }
}
