export interface ScanInput {
  brand_name: string
  website_url: string

  core_problem: string
  target_buyer: string
  differentiators?: string

  competitors?: string[]
  buyer_questions?: string[]

  plan_tier: "free" | "pro" | "enterprise"
}
