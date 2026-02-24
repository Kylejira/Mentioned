import type { ScoringInput, ScoringBreakdown } from "./types"
import { SCORING_WEIGHTS } from "./weights"

export class ScoringEngine {
  score(input: ScoringInput): ScoringBreakdown {
    const { analyses, total_queries } = input

    if (total_queries === 0) return this.emptyScore()

    // 1. Mention rate
    const mentions = analyses.filter((a) => a.brand_detection.detected)
    const mention_rate = mentions.length / analyses.length

    // 2. Position-weighted score
    let positionSum = 0
    let positionCount = 0
    for (const a of mentions) {
      const pos = a.brand_detection.position
      if (pos !== null && pos >= 1) {
        const pw = SCORING_WEIGHTS.position[Math.min(pos, 4)] ?? 0.3
        positionSum += pw
        positionCount++
      }
    }
    const weighted_position_score =
      positionCount > 0 ? positionSum / positionCount : mention_rate * 0.5

    // 3. Intent-weighted score
    let intentSum = 0
    let intentWeightSum = 0
    for (const a of analyses) {
      const iw = SCORING_WEIGHTS.intent[a.query.intent] ?? 1.0
      intentWeightSum += iw
      if (a.brand_detection.detected) {
        intentSum += iw
      }
    }
    const intent_weighted_score =
      intentWeightSum > 0 ? intentSum / intentWeightSum : mention_rate

    // 4. Cross-model consistency (Refinement 4: wider range 0.6–1.0)
    const queryMap = new Map<string, { openai: boolean; claude: boolean }>()
    for (const a of analyses) {
      const key = a.query.text
      if (!queryMap.has(key)) {
        queryMap.set(key, { openai: false, claude: false })
      }
      const entry = queryMap.get(key)!
      if (a.provider === "openai") entry.openai = a.brand_detection.detected
      if (a.provider === "claude") entry.claude = a.brand_detection.detected
    }

    let agreements = 0
    let pairs = 0
    for (const [, v] of queryMap) {
      pairs++
      if (v.openai === v.claude) agreements++
    }

    // 0% agreement = 0.6 (40% penalty), 100% agreement = 1.0 (no penalty)
    const cross_model_consistency =
      pairs > 0 ? 0.6 + 0.4 * (agreements / pairs) : 1.0

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

    return {
      mention_rate,
      weighted_position_score,
      intent_weighted_score,
      cross_model_consistency,
      competitor_density_factor,
      raw_score,
      final_score,
    }
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
    }
  }
}
