/**
 * Single source of truth for AI provider naming.
 *
 * The scan runner uses short "runner" names (openai/claude/gemini) when
 * calling provider adapters. Everything that persists to the database or
 * compares against the plan config must use the "canonical" name
 * (openai/anthropic/google/perplexity).
 *
 * Import {@link normalizeProvider} or {@link PROVIDER_NAME_MAP} from this
 * file — do NOT redefine the mapping inline. Keeping it here means a
 * future provider (or rename) is a one-line change.
 */

export const PROVIDER_NAME_MAP = {
  openai: "openai",
  claude: "anthropic",
  gemini: "google",
  perplexity: "perplexity",
} as const

export type RunnerProviderName = keyof typeof PROVIDER_NAME_MAP
export type CanonicalProviderName = (typeof PROVIDER_NAME_MAP)[RunnerProviderName]

/**
 * Best-effort default model per canonical provider. Used when persisting
 * scan_results so we can answer "which model produced this response?"
 * without threading the model name through the call chain.
 *
 * TODO: source from scan-runner config (src/lib/scan-runner.ts:52-59)
 * instead of hardcoding. If you change a model in scan-runner.ts, change
 * it here too.
 */
export const PROVIDER_MODELS: Record<CanonicalProviderName, string | null> = {
  openai: "gpt-5.4-mini",
  anthropic: "claude-haiku-4-5-20251001",
  google: "gemini-2.5-flash",
  perplexity: null,
}

/**
 * Normalize an unknown provider string into a canonical provider name.
 * Returns null for unknown inputs so callers can decide whether to skip,
 * log, or throw.
 */
export function normalizeProvider(p: string): CanonicalProviderName | null {
  return (PROVIDER_NAME_MAP as Record<string, CanonicalProviderName>)[p] ?? null
}
