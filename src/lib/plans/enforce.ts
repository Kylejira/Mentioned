import { getPlanConfig } from "./config"

const PROVIDER_NAME_MAP: Record<string, string> = {
  openai: "openai",
  claude: "anthropic",
  anthropic: "anthropic",
  gemini: "google",
  google: "google",
  perplexity: "perplexity",
}

const PROVIDER_RUNNER_MAP: Record<string, string> = {
  openai: "openai",
  anthropic: "claude",
  google: "gemini",
  perplexity: "perplexity",
}

export function getAllowedProviders(plan: string): string[] {
  const configProviders = getPlanConfig(plan).providers
  return configProviders
    .map((p) => PROVIDER_RUNNER_MAP[p])
    .filter(Boolean) as string[]
}

export function isProviderAllowed(plan: string, runnerProviderName: string): boolean {
  const configName = PROVIDER_NAME_MAP[runnerProviderName]
  if (!configName) return false
  return getPlanConfig(plan).providers.includes(configName)
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

export function getScansPerMonth(plan: string): number {
  return getPlanConfig(plan).scans_per_month
}

export function canRunScan(plan: string, scansUsedThisPeriod: number): boolean {
  const limit = getPlanConfig(plan).scans_per_month
  if (limit === -1) return true
  return scansUsedThisPeriod < limit
}
