import type { SupabaseClient } from "@supabase/supabase-js"
import { scoreOpportunity } from "./opportunity-scorer"
import type { EngagementMetrics } from "./opportunity-scorer"
import { log } from "@/lib/logger"

const logger = log.create("opportunity-scoring")

// ---------------------------------------------------------------------------
// Input type — what the discovery pipeline provides
// ---------------------------------------------------------------------------

export interface RawConversation {
  id?: string
  text: string
  full_thread_text?: string
  platform: string
  posted_at: string
  engagement: EngagementMetrics
  url?: string
  author?: string
  title?: string
  [key: string]: unknown
}

export interface ScoringContext {
  query: string
  product_keywords: string[]
  known_competitors: string[]
}

// ---------------------------------------------------------------------------
// Score a conversation and return DB-ready fields
// ---------------------------------------------------------------------------

export function buildScoredFields(
  conversation: RawConversation,
  context: ScoringContext
) {
  const score = scoreOpportunity(
    {
      text: conversation.text,
      full_thread_text: conversation.full_thread_text,
      platform: conversation.platform,
      posted_at: conversation.posted_at,
      engagement: conversation.engagement,
    },
    context.query,
    context.product_keywords,
    context.known_competitors
  )

  return {
    opportunity_score: score.total,
    opportunity_tier: score.tier,
    opportunity_signals: score.signals,
    opportunity_reasons: score.reasons,
    scored_at: score.scored_at,
  }
}

// ---------------------------------------------------------------------------
// Score + insert a conversation into the DB
// Call this from the discovery pipeline after a conversation is found.
//
// Usage:
//   await scoreAndStoreConversation(supabase, rawConversation, {
//     query: scan.query,
//     product_keywords: scan.product_keywords,
//     known_competitors: scan.known_competitors,
//   })
// ---------------------------------------------------------------------------

export async function scoreAndStoreConversation(
  supabase: SupabaseClient,
  conversation: RawConversation,
  context: ScoringContext
): Promise<void> {
  const scoredFields = buildScoredFields(conversation, context)

  const { error } = await supabase.from("conversations").insert({
    ...conversation,
    ...scoredFields,
  })

  if (error) {
    logger.error("Failed to store scored conversation", {
      error: error.message,
      score: scoredFields.opportunity_score,
      tier: scoredFields.opportunity_tier,
    })
    throw error
  }

  logger.debug("Stored scored conversation", {
    score: scoredFields.opportunity_score,
    tier: scoredFields.opportunity_tier,
    platform: conversation.platform,
  })
}

// ---------------------------------------------------------------------------
// Re-score existing conversations (for periodic cron job)
// Only updates if score changed by ±5 points.
// ---------------------------------------------------------------------------

export async function rescoreConversations(
  supabase: SupabaseClient,
  context: ScoringContext,
  options: { daysBack?: number; batchSize?: number } = {}
): Promise<{ updated: number; skipped: number }> {
  const { daysBack = 7, batchSize = 1000 } = options
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString()

  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("id, text, full_thread_text, platform, posted_at, engagement, opportunity_score")
    .gte("created_at", since)
    .is("replied_at", null)
    .limit(batchSize)

  if (error || !conversations) {
    logger.error("Failed to fetch conversations for re-scoring", {
      error: error?.message,
    })
    return { updated: 0, skipped: 0 }
  }

  let updated = 0
  let skipped = 0

  for (const conv of conversations) {
    const newScore = scoreOpportunity(
      {
        text: conv.text,
        full_thread_text: conv.full_thread_text,
        platform: conv.platform,
        posted_at: conv.posted_at,
        engagement: conv.engagement || {},
      },
      context.query,
      context.product_keywords,
      context.known_competitors
    )

    if (Math.abs(newScore.total - (conv.opportunity_score || 0)) >= 5) {
      await supabase
        .from("conversations")
        .update({
          opportunity_score: newScore.total,
          opportunity_tier: newScore.tier,
          opportunity_signals: newScore.signals,
          opportunity_reasons: newScore.reasons,
          scored_at: newScore.scored_at,
        })
        .eq("id", conv.id)

      updated++
    } else {
      skipped++
    }
  }

  logger.info("Re-score complete", { updated, skipped, total: conversations.length })
  return { updated, skipped }
}
