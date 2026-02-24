import type { ResponseAnalysis } from "../detection/types"

export interface ScoringInput {
  analyses: ResponseAnalysis[]
  total_queries: number
}

export interface ScoringBreakdown {
  mention_rate: number
  weighted_position_score: number
  intent_weighted_score: number
  cross_model_consistency: number
  competitor_density_factor: number
  raw_score: number
  final_score: number
}
