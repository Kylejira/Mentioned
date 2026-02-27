import { createClient } from "@/lib/supabase-server"
import { log } from "@/lib/logger"

const logger = log.create("scan-history")

export async function deleteScanHistory(userId: string, scanId: string) {
  try {
    const supabase = await createClient()

    const { data: scan, error: fetchError } = await supabase
      .from("scan_history")
      .select("id, user_id")
      .eq("id", scanId)
      .single()

    if (fetchError || !scan) {
      return { error: "Scan not found" }
    }

    if (scan.user_id !== userId) {
      return { error: "Unauthorized" }
    }

    const { error } = await supabase
      .from("scan_history")
      .delete()
      .eq("id", scanId)
      .eq("user_id", userId)

    if (error) {
      logger.error("Failed to delete scan", { error: error.message })
      return { error: "Failed to delete scan" }
    }

    return { success: true }
  } catch (err) {
    logger.error("Exception deleting scan", { error: String(err) })
    return { error: "Failed to delete scan" }
  }
}
