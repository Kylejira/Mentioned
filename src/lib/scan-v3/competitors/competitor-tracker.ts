import type { SupabaseClient } from "@supabase/supabase-js"
import { log } from "@/lib/logger"
import type { ResponseAnalysis } from "../detection/types"

const logger = log.create("competitor-tracker")
import type { CompetitorSnapshot, CompetitorRecord } from "./types"

export class CompetitorTracker {
  constructor(private supabase: SupabaseClient) {}

  async track(
    brandDomain: string,
    analyses: ResponseAnalysis[]
  ): Promise<CompetitorRecord[]> {
    const competitorMap = new Map<string, { count: number; positions: number[] }>()

    for (const analysis of analyses) {
      for (const cd of analysis.competitor_detections) {
        if (!cd.detected) continue
        const name = cd.brand_name.toLowerCase()
        if (!competitorMap.has(name)) {
          competitorMap.set(name, { count: 0, positions: [] })
        }
        const entry = competitorMap.get(name)!
        entry.count++
        if (cd.position !== null) entry.positions.push(cd.position)
      }
    }

    const snapshots: CompetitorSnapshot[] = [...competitorMap.entries()]
      .map(([name, data]) => ({
        name,
        mention_count: data.count,
        avg_position:
          data.positions.length > 0
            ? data.positions.reduce((a, b) => a + b, 0) / data.positions.length
            : 99,
        visibility_estimate: Math.min(
          100,
          Math.round((data.count / analyses.length) * 100)
        ),
      }))
      .sort((a, b) => b.mention_count - a.mention_count || a.avg_position - b.avg_position)
      .slice(0, 3)

    const { data: previous } = await this.supabase
      .from("competitor_tracking")
      .select("*")
      .eq("brand_domain", brandDomain)
      .order("rank", { ascending: true })

    const prevMap = new Map(
      (previous || []).map((r: CompetitorRecord) => [r.competitor_name.toLowerCase(), r])
    )

    const records: CompetitorRecord[] = snapshots.map((snap, idx) => {
      const prev = prevMap.get(snap.name)
      let trend: CompetitorRecord["trend"] = "new"
      if (prev) {
        if (snap.mention_count > prev.last_mention_count) trend = "up"
        else if (snap.mention_count < prev.last_mention_count) trend = "down"
        else trend = "stable"
      }

      return {
        brand_domain: brandDomain,
        competitor_name: snap.name,
        rank: idx + 1,
        last_mention_count: snap.mention_count,
        last_avg_position: snap.avg_position,
        trend,
        updated_at: new Date().toISOString(),
      }
    })

    if (records.length > 0) {
      await this.supabase
        .from("competitor_tracking")
        .delete()
        .eq("brand_domain", brandDomain)

      const { error } = await this.supabase
        .from("competitor_tracking")
        .insert(records)

      if (error) logger.error("Failed to persist competitors", { error: error.message })
    }

    return records
  }

  async getCompetitors(brandDomain: string): Promise<CompetitorRecord[]> {
    const { data, error } = await this.supabase
      .from("competitor_tracking")
      .select("*")
      .eq("brand_domain", brandDomain)
      .order("rank", { ascending: true })

    if (error) return []
    return data as CompetitorRecord[]
  }
}
