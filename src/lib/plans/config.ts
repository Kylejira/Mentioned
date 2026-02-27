export interface PlanConfig {
  id: string
  name: string
  scans_per_month: number
  providers: string[]
  max_queries_per_scan: number
  recurring_enabled: boolean
  strategic_brain_enabled: boolean
  max_brands: number
  max_concurrent_llm: number
}

export const PLAN_CONFIGS: Record<string, PlanConfig> = {
  free: {
    id: "free",
    name: "Free",
    scans_per_month: 1,
    providers: ["openai", "anthropic"],
    max_queries_per_scan: 20,
    recurring_enabled: false,
    strategic_brain_enabled: false,
    max_brands: 1,
    max_concurrent_llm: 5,
  },
  starter: {
    id: "starter",
    name: "Starter",
    scans_per_month: 10,
    providers: ["openai", "anthropic"],
    max_queries_per_scan: 30,
    recurring_enabled: false,
    strategic_brain_enabled: false,
    max_brands: 1,
    max_concurrent_llm: 10,
  },
  pro: {
    id: "pro",
    name: "Pro",
    scans_per_month: 30,
    providers: ["openai", "anthropic", "google", "perplexity"],
    max_queries_per_scan: 60,
    recurring_enabled: true,
    strategic_brain_enabled: true,
    max_brands: 1,
    max_concurrent_llm: 15,
  },
  pro_monthly: {
    id: "pro_monthly",
    name: "Pro",
    scans_per_month: 30,
    providers: ["openai", "anthropic", "google", "perplexity"],
    max_queries_per_scan: 60,
    recurring_enabled: true,
    strategic_brain_enabled: true,
    max_brands: 1,
    max_concurrent_llm: 15,
  },
  pro_annual: {
    id: "pro_annual",
    name: "Pro",
    scans_per_month: 30,
    providers: ["openai", "anthropic", "google", "perplexity"],
    max_queries_per_scan: 60,
    recurring_enabled: true,
    strategic_brain_enabled: true,
    max_brands: 1,
    max_concurrent_llm: 15,
  },
  pro_plus: {
    id: "pro_plus",
    name: "Pro+",
    scans_per_month: 60,
    providers: ["openai", "anthropic", "google", "perplexity"],
    max_queries_per_scan: 80,
    recurring_enabled: true,
    strategic_brain_enabled: true,
    max_brands: 5,
    max_concurrent_llm: 15,
  },
}

export function getPlanConfig(plan: string): PlanConfig {
  if (!plan) return PLAN_CONFIGS.free
  const normalized = plan.toLowerCase().trim()
  return PLAN_CONFIGS[normalized] || PLAN_CONFIGS.free
}
