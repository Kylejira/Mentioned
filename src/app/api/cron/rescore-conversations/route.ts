import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { scoreOpportunity } from "@/lib/scoring/opportunity-scorer"
import { log } from "@/lib/logger"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const logger = log.create("cron-rescore")

const BATCH_SIZE = 1000
const DAYS_BACK = 7
const SCORE_CHANGE_THRESHOLD = 5

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  const header = request.headers.get("authorization")
  return header === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startTime = Date.now()
  const db = createAdminClient()
  const since = new Date(Date.now() - DAYS_BACK * 24 * 60 * 60 * 1000).toISOString()

  logger.info("Starting conversation re-score", { since, batchSize: BATCH_SIZE })

  // Fetch conversations from last 7 days that haven't been replied to
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
    .gte("created_at", since)
    .is("replied_at", null)
    .limit(BATCH_SIZE)

  if (error) {
    logger.error("Failed to fetch conversations for re-scoring", {
      error: error.message,
    })
    return NextResponse.json(
      { error: "Failed to fetch conversations", detail: error.message },
      { status: 500 }
    )
  }

  if (!conversations || conversations.length === 0) {
    logger.info("No conversations to re-score")
    return NextResponse.json({ updated: 0, skipped: 0, total: 0 })
  }

  // Collect scan IDs to fetch their context (query, keywords, competitors)
  const scanIds = [...new Set(conversations.map((c) => c.scan_id).filter(Boolean))]

  // Fetch scan context for scoring
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

  let updated = 0
  let skipped = 0

  for (const conv of conversations) {
    const ctx = scanContextMap[conv.scan_id] || { query: "", keywords: [], competitors: [] }

    const newScore = scoreOpportunity(
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

    const oldScore = conv.opportunity_score || 0

    if (Math.abs(newScore.total - oldScore) >= SCORE_CHANGE_THRESHOLD) {
      const { error: updateError } = await db
        .from("conversations")
        .update({
          opportunity_score: newScore.total,
          opportunity_tier: newScore.tier,
          opportunity_signals: newScore.signals,
          opportunity_reasons: newScore.reasons,
          scored_at: newScore.scored_at,
        })
        .eq("id", conv.id)

      if (updateError) {
        logger.warn("Failed to update conversation score", {
          convId: conv.id,
          error: updateError.message,
        })
      } else {
        updated++
      }
    } else {
      skipped++
    }
  }

  const elapsed = Date.now() - startTime

  logger.info("Re-score complete", {
    total: conversations.length,
    updated,
    skipped,
    elapsedMs: elapsed,
  })

  return NextResponse.json({
    total: conversations.length,
    updated,
    skipped,
    elapsed_ms: elapsed,
  })
}
