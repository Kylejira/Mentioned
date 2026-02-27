import { getPlanConfig } from "./config"

export function getAllowedProviders(plan: string): string[] {
  return getPlanConfig(plan).providers
}

export function canUseRecurring(plan: string): boolean {
  return getPlanConfig(plan).recurring_enabled
}

export function canUseStrategicBrain(plan: string): boolean {
  return getPlanConfig(plan).strategic_brain_enabled
}

export function canAddBrand(plan: string, currentBrandCount: number): boolean {
  return currentBrandCount < getPlanConfig(plan).max_brands
}

export function getMaxQueries(plan: string): number {
  return getPlanConfig(plan).max_queries_per_scan
}

export function getConcurrencyLimit(plan: string): number {
  return getPlanConfig(plan).max_concurrent_llm
}
