import { createClient } from "@/lib/supabase-server"
import { log } from "@/lib/logger"

const logger = log.create("scan-history")

export interface ScanHistoryEntry {
  id: string
  productUrl: string
  productName: string
  category: string | null
  score: number
  mentionRate: number
  top3Rate: number
  avgPosition: number | null
  chatgptScore: number | null
  claudeScore: number | null
  chatgptMentioned: boolean | null
  claudeMentioned: boolean | null
  scannedAt: string
}

export async function getScanHistory(
  userId: string,
  productUrl?: string,
  limit: number = 20
): Promise<ScanHistoryEntry[]> {
  try {
    const supabase = await createClient()

    let query = supabase
      .from("scan_history")
      .select("*")
      .eq("user_id", userId)
      .order("scanned_at", { ascending: true })
      .limit(limit)

    if (productUrl) {
      query = query.eq("product_url", productUrl)
    }

    const { data, error } = await query

    if (error) {
      logger.error("Failed to fetch scan history", { error: error.message })
      return []
    }

    return (data || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      productUrl: row.product_url as string,
      productName: row.product_name as string,
      category: row.category as string | null,
      score: row.score as number,
      mentionRate: row.mention_rate as number,
      top3Rate: row.top_3_rate as number,
      avgPosition: row.avg_position as number | null,
      chatgptScore: row.chatgpt_score as number | null,
      claudeScore: row.claude_score as number | null,
      chatgptMentioned: row.chatgpt_mentioned as boolean | null,
      claudeMentioned: row.claude_mentioned as boolean | null,
      scannedAt: row.scanned_at as string,
    }))
  } catch (err) {
    logger.error("Exception fetching scan history", { error: String(err) })
    return []
  }
}

export async function getScannedProducts(
  userId: string
): Promise<{ url: string; name: string; lastScore: number; lastScannedAt: string }[]> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("scan_history")
      .select("product_url, product_name, score, scanned_at")
      .eq("user_id", userId)
      .order("scanned_at", { ascending: false })

    if (error) {
      logger.error("Failed to fetch scanned products", { error: error.message })
      return []
    }

    const productMap = new Map<
      string,
      { url: string; name: string; lastScore: number; lastScannedAt: string }
    >()

    for (const row of data || []) {
      if (!productMap.has(row.product_url)) {
        productMap.set(row.product_url, {
          url: row.product_url,
          name: row.product_name,
          lastScore: row.score,
          lastScannedAt: row.scanned_at,
        })
      }
    }

    return Array.from(productMap.values())
  } catch (err) {
    logger.error("Exception fetching scanned products", { error: String(err) })
    return []
  }
}
