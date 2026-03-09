'use client'

import { ProviderCard } from "@/components/provider-card"
import { getProviderLabel } from "@/lib/provider-colors"

interface ByModelData {
  [provider: string]: number
}

interface ProviderDetails {
  [provider: string]: {
    avg_position: number | null
    sentiment: "positive" | "neutral" | "negative" | null
    mention_rate: number
    mention_count: number
    total_queries: number
  }
}

const SENTIMENT_MAP: Record<string, number> = {
  positive: 1,
  neutral: 0,
  negative: -1,
}

interface ProviderComparisonProps {
  data: ByModelData | null
  mentionRates?: ByModelData | null
  providerDetails?: ProviderDetails | null
  totalQueries?: number
  deltas?: Record<string, any> | null
}

export function ProviderComparison({ data, mentionRates, providerDetails, totalQueries, deltas }: ProviderComparisonProps) {
  if (!data) {
    return null
  }

  const providers = Object.entries(data).filter(([, score]) => typeof score === "number")

  if (providers.length === 0) return null

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {providers.map(([provider, compositeScore]) => {
          const providerKey = provider === "chatgpt" ? "openai" : provider
          const details = providerDetails?.[provider]
          const queries = details?.total_queries ?? totalQueries ?? 0
          const mRate = mentionRates?.[provider] ?? compositeScore
          const mentionCount = details?.mention_count ?? (queries > 0 ? Math.round((mRate / 100) * queries) : 0)

          const providerDelta = deltas?.providers?.[providerKey]?.delta ?? null

          const avgPos = details?.avg_position ?? null
          const sentimentAvg = details?.sentiment != null ? (SENTIMENT_MAP[details.sentiment] ?? null) : null
          const categoryCoverage = details
            ? (details.mention_count > 0 ? details.mention_count / Math.max(details.total_queries, 1) : 0)
            : mRate / 100

          return (
            <ProviderCard
              key={provider}
              provider={providerKey}
              composite_score={compositeScore}
              mention_rate={details?.mention_rate ?? mRate / 100}
              avg_position={avgPos !== null ? Math.round(avgPos) : 0}
              sentiment_avg={sentimentAvg}
              category_coverage={categoryCoverage}
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
