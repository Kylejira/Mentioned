import { createAdminClient } from "@/lib/supabase-admin"
import { createClient as createServerClient } from "@/lib/supabase-server"
import { log } from "@/lib/logger"

const logger = log.create("scan-history")

interface ScanResult {
  productUrl: string
  productName: string
  category?: string
  score: number
  mentionRate: number
  top3Rate: number
  avgPosition?: number | null
  chatgptScore?: number | null
  claudeScore?: number | null
  chatgptMentioned?: boolean | null
  claudeMentioned?: boolean | null
  fullResult?: Record<string, unknown> | null
}

export async function saveScanHistory(userId: string, scanResult: ScanResult) {
  try {
    let supabase
    try {
      supabase = createAdminClient()
    } catch {
      logger.warn("Admin client unavailable, falling back to server client")
      supabase = await createServerClient()
    }

    const { error } = await supabase.from("scan_history").insert({
      user_id: userId,
      product_url: scanResult.productUrl,
      product_name: scanResult.productName,
      category: scanResult.category || null,
      score: scanResult.score,
      mention_rate: scanResult.mentionRate,
      top_3_rate: scanResult.top3Rate,
      avg_position: scanResult.avgPosition || null,
      chatgpt_score: scanResult.chatgptScore || null,
      claude_score: scanResult.claudeScore || null,
      chatgpt_mentioned: scanResult.chatgptMentioned ?? null,
      claude_mentioned: scanResult.claudeMentioned ?? null,
      full_result: scanResult.fullResult || null,
      scanned_at: new Date().toISOString(),
    })

    if (error) {
      logger.error("Failed to save scan history", { error: error.message })
      return { error }
    }

    logger.info("Scan history saved", { product: scanResult.productName })
    return { error: null }
  } catch (err) {
    logger.error("Exception saving scan history", { error: String(err) })
    return { error: err }
  }
}
