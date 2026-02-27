export interface ProductData {
  product_name: string
  product_name_variations: string[]
  company_name: string
  one_line_description: string
  category: string
  subcategories: string[]
  product_type: "software" | "physical_product" | "service" | "marketplace" | "content"
  target_audience: {
    who: string
    company_size: string
    industry: string
  }
  key_features: string[]
  use_cases: string[]
  competitors_mentioned: string[]
  likely_competitors: string[]
  integrations: string[]
  pricing_model: string
  geography: {
    country: string
    evidence: string
  }
  unique_selling_points: string[]
  brand_voice: string
  url: string
  raw_content_length: number
}

export interface ActionItem {
  id: string
  number: number
  category: "social_proof" | "content" | "positioning"
  type: string
  title: string
  what_we_found: string
  competitor_comparison: string
  why_it_matters: string
  what_to_do: string
  effort: "30 mins" | "1-2 hours" | "2-3 hours" | "half day"
  impact: "high" | "medium" | "low"
  generate_type: "comparison_page" | "headline" | "faq" | "testimonial_email" | "use_case_page" | null
}
