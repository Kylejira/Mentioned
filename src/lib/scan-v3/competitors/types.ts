export interface CompetitorSnapshot {
  name: string
  mention_count: number
  avg_position: number
  visibility_estimate: number
}

export interface CompetitorRecord {
  brand_domain: string
  competitor_name: string
  rank: number
  last_mention_count: number
  last_avg_position: number
  trend: "up" | "down" | "stable" | "new"
  updated_at: string
}
