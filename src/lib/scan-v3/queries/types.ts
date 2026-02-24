export type IntentCluster =
  | "direct_recommendation"
  | "alternatives"
  | "comparison"
  | "problem_based"
  | "feature_based"
  | "budget_based"
  | "user_provided"

export interface GeneratedQuery {
  text: string
  intent: IntentCluster
  generated_by: "llm"
}

export interface ValidatedQuery extends GeneratedQuery {
  is_relevant: boolean
  intent_score: number
  has_brand_bias: boolean
  dedupe_hash: string
}

export interface QuerySet {
  scan_id: string
  queries: ValidatedQuery[]
  generated_at: string
  total_generated: number
  total_after_validation: number
}
