import type { SupabaseClient } from "@supabase/supabase-js"

export interface BrandShare {
  name: string
  is_self: boolean
  total_mentions: number
  share: number
  share_pct: number
  per_provider: Record<string, { mentions: number; share: number }>
}

export interface ShareOfVoice {
  brands: BrandShare[]
  your_rank: number
  total_responses: number
  computed_at: string
}

interface MentionEntry {
  total: number
  byProvider: Record<string, number>
  displayName: string
}

export async function computeShareOfVoice(
  scanId: string,
  brandName: string,
  supabase: SupabaseClient
): Promise<ShareOfVoice> {
  const empty: ShareOfVoice = {
    brands: [],
    your_rank: 0,
    total_responses: 0,
    computed_at: new Date().toISOString(),
  }

  const { data: results } = await supabase
    .from("scan_results")
    .select("provider, brand_mentioned, competitors_detected")
    .eq("scan_id", scanId)

  if (!results || results.length === 0) return empty

  const brandMentions: Record<string, MentionEntry> = {}
  const selfKey = brandName.toLowerCase().trim()

  function ensure(key: string, displayName: string): MentionEntry {
    if (!brandMentions[key]) {
      brandMentions[key] = { total: 0, byProvider: {}, displayName }
    }
    return brandMentions[key]
  }

  function increment(rawName: string, provider: string) {
    if (!rawName || typeof rawName !== "string") return
    const key = rawName.toLowerCase().trim()
    const entry = ensure(key, rawName)
    entry.total++
    entry.byProvider[provider] = (entry.byProvider[provider] || 0) + 1
  }

  ensure(selfKey, brandName)

  for (const row of results) {
    const provider = row.provider as string

    if (row.brand_mentioned === true) {
      increment(brandName, provider)
    }

    const competitors = row.competitors_detected as
      | Array<{ name?: string; [k: string]: unknown }>
      | null
      | undefined

    if (Array.isArray(competitors)) {
      for (const comp of competitors) {
        if (comp?.name) {
          increment(comp.name, provider)
        }
      }
    }
  }

  const totalMentions = Object.values(brandMentions).reduce((s, e) => s + e.total, 0)

  const providerTotals: Record<string, number> = {}
  for (const entry of Object.values(brandMentions)) {
    for (const [prov, count] of Object.entries(entry.byProvider)) {
      providerTotals[prov] = (providerTotals[prov] || 0) + count
    }
  }

  const brands: BrandShare[] = Object.entries(brandMentions).map(([key, entry]) => {
    const share = totalMentions > 0 ? entry.total / totalMentions : 0

    const per_provider: Record<string, { mentions: number; share: number }> = {}
    for (const [prov, count] of Object.entries(entry.byProvider)) {
      const provTotal = providerTotals[prov] || 0
      per_provider[prov] = {
        mentions: count,
        share: provTotal > 0 ? count / provTotal : 0,
      }
    }

    return {
      name: entry.displayName,
      is_self: key === selfKey,
      total_mentions: entry.total,
      share,
      share_pct: Math.round(share * 100),
      per_provider,
    }
  })

  brands.sort((a, b) => b.share - a.share)

  const selfIndex = brands.findIndex((b) => b.is_self)
  const your_rank = selfIndex >= 0 ? selfIndex + 1 : 0

  return {
    brands,
    your_rank,
    total_responses: results.length,
    computed_at: new Date().toISOString(),
  }
}
