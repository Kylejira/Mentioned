import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { scoreOpportunity } from "@/lib/scoring/opportunity-scorer"
import { log } from "@/lib/logger"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const logger = log.create("backfill-scores")

const BATCH_SIZE = 500

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  const header = request.headers.get("authorization")
  return header === `Bearer ${secret}`
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startTime = Date.now()
  const db = createAdminClient()

  logger.info("Starting one-time score backfill")

  let totalProcessed = 0
  let totalUpdated = 0
  let totalErrors = 0
  let hasMore = true

  while (hasMore) {
    // Fetch unscored conversations in batches
    const { data: conversations, error } = await db
      .from("conversations")
      .select(`
        id,
        text,
        full_thread_text,
        platform,
        posted_at,
        engagement,
        opportunity_score,
        user_id,
        scan_id
      `)
      .or("opportunity_score.is.null,opportunity_score.eq.0")
      .limit(BATCH_SIZE)

    if (error) {
      logger.error("Failed to fetch unscored conversations", {
        error: error.message,
      })
      return NextResponse.json(
        { error: "Failed to fetch conversations", detail: error.message },
        { status: 500 }
      )
    }

    if (!conversations || conversations.length === 0) {
      hasMore = false
      break
    }

    // Collect unique scan IDs to fetch context
    const scanIds = [...new Set(conversations.map((c) => c.scan_id).filter(Boolean))]

    let scanContextMap: Record<string, { query: string; keywords: string[]; competitors: string[] }> = {}

    if (scanIds.length > 0) {
      const { data: scans } = await db
        .from("scans")
        .select("id, buyer_questions, saas_profile")
        .in("id", scanIds)

      if (scans) {
        for (const scan of scans) {
          const profile = (scan.saas_profile || {}) as Record<string, unknown>
          const questions = (scan.buyer_questions || []) as string[]
          scanContextMap[scan.id] = {
            query: questions[0] || "",
            keywords: (profile.keywords as string[]) || [],
            competitors: (profile.competitors as string[]) || [],
          }
        }
      }
    }

    for (const conv of conversations) {
      const ctx = scanContextMap[conv.scan_id] || { query: "", keywords: [], competitors: [] }

      const result = scoreOpportunity(
        {
          text: conv.text || "",
          full_thread_text: conv.full_thread_text,
          platform: conv.platform || "unknown",
          posted_at: conv.posted_at || new Date().toISOString(),
          engagement: conv.engagement || {},
        },
        ctx.query,
        ctx.keywords,
        ctx.competitors
      )

      const { error: updateError } = await db
        .from("conversations")
        .update({
          opportunity_score: result.total,
          opportunity_tier: result.tier,
          opportunity_signals: result.signals,
          opportunity_reasons: result.reasons,
          scored_at: result.scored_at,
        })
        .eq("id", conv.id)

      if (updateError) {
        logger.warn("Failed to update conversation", {
          id: conv.id,
          error: updateError.message,
        })
        totalErrors++
      } else {
        totalUpdated++
      }

      totalProcessed++
    }

    // If we got fewer rows than BATCH_SIZE, we're done
    if (conversations.length < BATCH_SIZE) {
      hasMore = false
    }

    logger.info("Backfill batch complete", {
      batchSize: conversations.length,
      totalProcessed,
      totalUpdated,
    })
  }

  const elapsed = Date.now() - startTime

  logger.info("Backfill complete", {
    totalProcessed,
    totalUpdated,
    totalErrors,
    elapsedMs: elapsed,
  })

  return NextResponse.json({
    total_processed: totalProcessed,
    total_updated: totalUpdated,
    total_errors: totalErrors,
    elapsed_ms: elapsed,
  })
}
