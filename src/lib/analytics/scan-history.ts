import { createAdminClient } from "@/lib/supabase-admin"
import type { ProviderScore, ScoringBreakdown } from "@/lib/scan-v3/scoring/types"
import { log } from "@/lib/logger"

const logger = log.create("analytics-scan-history")

export interface ScanTrendPoint {
  date: string
  overall_score: number
  mention_rate: number
  consistency_score: number
  provider_scores: ProviderScore[]
}

export interface ScanTrendData {
  project_id: string
  points: ScanTrendPoint[]
  total_scans: number
}

export async function getScanTrendData(projectId: string): Promise<ScanTrendData> {
  const db = createAdminClient()

  const { data, error } = await db
    .from("scans")
    .select("id, score, score_breakdown, provider_scores, created_at")
    .eq("brand_id", projectId)
    .not("score", "is", null)
    .order("created_at", { ascending: false })
    .limit(12)

  if (error) {
    logger.error("Failed to fetch scan trend data", { projectId, error: error.message })
    return { project_id: projectId, points: [], total_scans: 0 }
  }

  if (!data || data.length === 0) {
    return { project_id: projectId, points: [], total_scans: 0 }
  }

  const points: ScanTrendPoint[] = data
    .map((scan) => {
      const breakdown = scan.score_breakdown as ScoringBreakdown | null
      const providerScores = (scan.provider_scores as ProviderScore[]) ?? []

      return {
        date: scan.created_at as string,
        overall_score: (scan.score as number) ?? 0,
        mention_rate: breakdown?.mention_rate ?? 0,
        consistency_score: breakdown?.cross_model_consistency ?? 1,
        provider_scores: providerScores,
      }
    })
    .reverse()

  logger.info("Scan trend data fetched", {
    projectId,
    pointCount: points.length,
    latestScore: points[points.length - 1]?.overall_score,
  })

  return {
    project_id: projectId,
    points,
    total_scans: points.length,
  }
}
