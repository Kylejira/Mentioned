'use client'

import { ProviderCard } from "@/components/provider-card"
import { getProviderLabel } from "@/lib/provider-colors"

interface ByModelData {
  [provider: string]: number
}

interface ProviderComparisonProps {
  data: ByModelData | null
  totalQueries?: number
  deltas?: Record<string, any> | null
}

export function ProviderComparison({ data, totalQueries, deltas }: ProviderComparisonProps) {
  if (!data) {
    return null
  }

  const providers = Object.entries(data).filter(([, score]) => typeof score === "number")

  if (providers.length === 0) return null

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {providers.map(([provider, mentionRate]) => {
          const providerKey = provider === "chatgpt" ? "openai" : provider
          const queries = totalQueries ?? 0
          const mentionCount = queries > 0 ? Math.round((mentionRate / 100) * queries) : 0

          const providerDelta = deltas?.providers?.[providerKey]?.delta ?? null

          return (
            <ProviderCard
              key={provider}
              provider={providerKey}
              composite_score={mentionRate}
              mention_rate={mentionRate / 100}
              avg_position={mentionRate > 0 ? 2 : 0}
              sentiment_avg={mentionRate >= 50 ? 1 : mentionRate > 0 ? 0 : -1}
              category_coverage={mentionRate / 100}
              mentions_count={mentionCount}
              total_queries={queries}
              scoreDelta={providerDelta}
            />
          )
        })}
      </div>
    </div>
  )
}
