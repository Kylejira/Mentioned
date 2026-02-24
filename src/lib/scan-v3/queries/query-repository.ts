import type { SupabaseClient } from "@supabase/supabase-js"
import type { ValidatedQuery } from "./types"

export class QueryRepository {
  constructor(private supabase: SupabaseClient) {}

  async store(scanId: string, queries: ValidatedQuery[]): Promise<void> {
    const { error } = await this.supabase.from("scan_query_sets").upsert(
      {
        scan_id: scanId,
        queries,
        total_generated: queries.length,
        total_validated: queries.filter((q) => q.is_relevant && !q.has_brand_bias).length,
        created_at: new Date().toISOString(),
      },
      { onConflict: "scan_id" }
    )

    if (error) throw new Error(`Failed to store query set: ${error.message}`)
  }

  async retrieve(scanId: string): Promise<ValidatedQuery[] | null> {
    const { data, error } = await this.supabase
      .from("scan_query_sets")
      .select("queries")
      .eq("scan_id", scanId)
      .single()

    if (error || !data) return null
    return data.queries as ValidatedQuery[]
  }
}
