export type PlanTier = "free" | "pro" | "enterprise"

export interface ScanLimits {
  maxQueries: number
  maxQueriesPerCluster: number
  enableSemanticConfirm: boolean
  maxConcurrentLlmCalls: number
}

const PLAN_LIMITS: Record<PlanTier, ScanLimits> = {
  free: {
    maxQueries: 30,
    maxQueriesPerCluster: 6,
    enableSemanticConfirm: false,
    maxConcurrentLlmCalls: 5,
  },
  pro: {
    maxQueries: 60,
    maxQueriesPerCluster: 12,
    enableSemanticConfirm: true,
    maxConcurrentLlmCalls: 10,
  },
  enterprise: {
    maxQueries: 100,
    maxQueriesPerCluster: 20,
    enableSemanticConfirm: true,
    maxConcurrentLlmCalls: 15,
  },
}

/**
 * Resolve scan limits from plan tier.
 * MAX_QUERIES_PER_SCAN env override takes precedence for testing/throttling.
 */
export function resolveLimits(plan: PlanTier): ScanLimits {
  const limits = { ...PLAN_LIMITS[plan] }

  const envMax = process.env.MAX_QUERIES_PER_SCAN
  if (envMax) {
    const parsed = parseInt(envMax, 10)
    if (!isNaN(parsed) && parsed > 0) {
      limits.maxQueries = Math.min(parsed, limits.maxQueries)
    }
  }

  return limits
}
