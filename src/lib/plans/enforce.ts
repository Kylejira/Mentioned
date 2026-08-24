import { getPlanConfig } from "./config"
import { PROVIDER_NAME_MAP, type CanonicalProviderName } from "@/lib/providers/names"

// Inverse of PROVIDER_NAME_MAP: canonical → runner name. Used only here.
const PROVIDER_RUNNER_MAP: Record<CanonicalProviderName, string> = Object.entries(
  PROVIDER_NAME_MAP,
).reduce((acc, [runner, canonical]) => {
  acc[canonical as CanonicalProviderName] = runner
  return acc
}, {} as Record<CanonicalProviderName, string>)

export function getAllowedProviders(plan: string): string[] {
  const configProviders = getPlanConfig(plan).providers
  return configProviders
    .map((p) => PROVIDER_RUNNER_MAP[p as CanonicalProviderName])
    .filter(Boolean) as string[]
}

export function isProviderAllowed(plan: string, runnerProviderName: string): boolean {
  const configName = (PROVIDER_NAME_MAP as Record<string, string>)[runnerProviderName]
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
