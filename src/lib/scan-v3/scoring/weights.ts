import type { LlmProviderName } from "../detection/types"

export type ProviderWeights = Record<LlmProviderName, number>

const DEFAULT_PROVIDER_WEIGHTS: ProviderWeights = {
  openai: 1.0,
  claude: 1.0,
  gemini: 0.8,
}

function loadProviderWeights(): ProviderWeights {
  const envWeights = process.env.PROVIDER_WEIGHTS
  if (!envWeights) return { ...DEFAULT_PROVIDER_WEIGHTS }

  try {
    const parsed = JSON.parse(envWeights) as Partial<ProviderWeights>
    return {
      openai: parsed.openai ?? DEFAULT_PROVIDER_WEIGHTS.openai,
      claude: parsed.claude ?? DEFAULT_PROVIDER_WEIGHTS.claude,
      gemini: parsed.gemini ?? DEFAULT_PROVIDER_WEIGHTS.gemini,
    }
  } catch {
    return { ...DEFAULT_PROVIDER_WEIGHTS }
  }
}

export const SCORING_WEIGHTS = {
  position: {
    1: 1.0,
    2: 0.7,
    3: 0.5,
    4: 0.3,
  } as Record<number, number>,

  intent: {
    user_provided: 2.0,
    direct_recommendation: 1.5,
    problem_based: 1.3,
    alternatives: 1.3,
    comparison: 1.2,
    feature_based: 0.9,
    budget_based: 0.8,
  } as Record<string, number>,

  components: {
    mention_rate: 0.35,
    position: 0.35,
    intent: 0.30,
  },

  providers: loadProviderWeights(),
}
