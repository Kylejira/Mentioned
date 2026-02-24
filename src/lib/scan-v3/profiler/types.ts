export interface SaaSProfile {
  brand_name: string
  domain: string
  tagline: string
  category: string
  subcategory: string
  target_audience: string
  core_features: string[]
  pricing_model: string
  competitors_mentioned: string[]
  key_differentiators: string[]
  use_cases: string[]
  brand_aliases: string[]

  // Form-sourced fields (higher signal than scraped equivalents)
  core_problem: string
  target_buyer: string
  user_differentiators: string
  buyer_questions: string[]
}
