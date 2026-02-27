import type { SupabaseClient } from "@supabase/supabase-js"

export interface ScoreDeltas {
  overall: { current: number; previous: number | null; delta: number | null }
  mention_rate: { current: number; previous: number | null; delta: number | null }
  consistency: { current: number; previous: number | null; delta: number | null }
  providers: Record<string, { current: number; previous: number | null; delta: number | null }>
  previous_scan_id: string | null
  previous_scan_date: string | null
}

interface ProviderComparisonEntry {
  provider: string
  mention_rate: number
  composite_score: number
}

interface CrossProviderMetrics {
  consistency_score: number
}

interface ProviderComparison {
  providers: ProviderComparisonEntry[]
  cross_provider: CrossProviderMetrics
}

function nullDelta(current: number): { current: number; previous: null; delta: null } {
  return { current, previous: null, delta: null }
}

export async function computeScoreDeltas(
  scanId: string,
  brandId: string,
  currentScores: {
    overall: number
    mention_rate: number
    consistency: number
    providerScores: Record<string, number>
  },
  supabase: SupabaseClient
): Promise<ScoreDeltas> {
  const { data: prevScan } = await supabase
    .from("scans")
    .select("id, score, summary, created_at")
    .eq("brand_id", brandId)
    .neq("id", scanId)
    .in("status", ["not_mentioned", "low_visibility", "recommended"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (!prevScan) {
    const providers: ScoreDeltas["providers"] = {}
    for (const key of Object.keys(currentScores.providerScores)) {
      providers[key] = nullDelta(currentScores.providerScores[key])
    }
    return {
      overall: nullDelta(currentScores.overall),
      mention_rate: nullDelta(currentScores.mention_rate),
      consistency: nullDelta(currentScores.consistency),
      providers,
      previous_scan_id: null,
      previous_scan_date: null,
    }
  }

  const summary = prevScan.summary as Record<string, unknown> | null
  const comparison = summary?.provider_comparison as ProviderComparison | undefined
  const prevProviders = comparison?.providers ?? []

  const prevOverall = (prevScan.score as number) ?? 0

  let prevMentionRate: number | null = null
  if (prevProviders.length > 0) {
    const sum = prevProviders.reduce((acc, p) => acc + p.mention_rate, 0)
    prevMentionRate = sum / prevProviders.length
  }

  const prevConsistency = comparison?.cross_provider?.consistency_score ?? null

  const providers: ScoreDeltas["providers"] = {}
  for (const [key, currentVal] of Object.entries(currentScores.providerScores)) {
    const match = prevProviders.find((p) => p.provider === key)
    if (match) {
      providers[key] = {
        current: currentVal,
        previous: match.composite_score,
        delta: currentVal - match.composite_score,
      }
    } else {
      providers[key] = nullDelta(currentVal)
    }
  }

  return {
    overall: {
      current: currentScores.overall,
      previous: prevOverall,
      delta: currentScores.overall - prevOverall,
    },
    mention_rate: {
      current: currentScores.mention_rate,
      previous: prevMentionRate,
      delta: prevMentionRate !== null ? currentScores.mention_rate - prevMentionRate : null,
    },
    consistency: {
      current: currentScores.consistency,
      previous: prevConsistency,
      delta: prevConsistency !== null ? currentScores.consistency - prevConsistency : null,
    },
    providers,
    previous_scan_id: prevScan.id as string,
    previous_scan_date: prevScan.created_at as string,
  }
}
