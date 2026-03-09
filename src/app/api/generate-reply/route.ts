import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { createAdminClient } from "@/lib/supabase-admin"
import { generateReplies } from "@/lib/reply-generator/reply-generator"
import type { ProductProfile, ConversationContext } from "@/lib/reply-generator/reply-generator"
import { log } from "@/lib/logger"

export const maxDuration = 60
export const dynamic = "force-dynamic"

const logger = log.create("generate-reply-api")

const DAILY_LIMIT = 20

const PRO_WHITELIST = (process.env.PRO_WHITELIST_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

// ---------------------------------------------------------------------------
// POST /api/generate-reply
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // ── 1. Auth ──
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // ── 2. Plan gating — free users blocked ──
    const isWhitelisted = PRO_WHITELIST.includes(user.email?.toLowerCase() || "")
    let isPaid = isWhitelisted

    if (!isPaid) {
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("plan, status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .single()

      isPaid = !!subscription?.plan
    }

    if (!isPaid) {
      return NextResponse.json(
        { error: "Reply generation requires a paid plan", code: "PLAN_REQUIRED" },
        { status: 403 }
      )
    }

    // ── 3. Parse body ──
    let body: { conversation_id?: string; tone_override?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const { conversation_id, tone_override } = body

    if (!conversation_id) {
      return NextResponse.json({ error: "conversation_id is required" }, { status: 400 })
    }

    // ── 4. Rate limit — max 20 generations per day per user ──
    const adminDb = createAdminClient()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { count: dailyCount } = await adminDb
      .from("reply_generations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", todayStart.toISOString())

    if ((dailyCount || 0) >= DAILY_LIMIT) {
      return NextResponse.json(
        { error: `Daily limit reached (${DAILY_LIMIT} generations per day)` },
        { status: 429 }
      )
    }

    // ── 5. Fetch conversation ──
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("id, text, full_thread_text, title, url, platform")
      .eq("id", conversation_id)
      .eq("user_id", user.id)
      .single()

    if (convError || !conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    // ── 6. Fetch product profile ──
    const { data: profile, error: profileError } = await supabase
      .from("product_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "No product profile. Set up your product profile in Settings first." },
        { status: 400 }
      )
    }

    // ── 7. Check if product already mentioned in thread ──
    const productName = profile.product_name || ""
    const threadText = (conversation.full_thread_text || conversation.text || "").toLowerCase()
    const productAlreadyMentioned = productName.length > 0 && threadText.includes(productName.toLowerCase())

    // ── 8. Build context and generate ──
    const baseThreadText = conversation.full_thread_text || conversation.text || ""
    const conversationCtx: ConversationContext = {
      id: conversation.id,
      platform: conversation.platform || "reddit",
      title: conversation.title,
      text: conversation.text,
      full_thread_text: productAlreadyMentioned
        ? baseThreadText + "\n\n[NOTE: The user's product has already been mentioned in this thread. Generate a reply that adds value without re-mentioning it.]"
        : conversation.full_thread_text,
      url: conversation.url,
    }

    const productProfile: ProductProfile = {
      product_name: profile.product_name,
      one_liner: profile.one_liner,
      description: profile.description,
      key_features: profile.key_features || [],
      target_audience: profile.target_audience,
      use_cases: profile.use_cases || [],
      competitors: profile.competitors || [],
      website_url: profile.website_url,
      preferred_tone: tone_override as ProductProfile["preferred_tone"] || profile.preferred_tone || "helpful",
      custom_instructions: profile.custom_instructions,
    }

    const result = await generateReplies(conversationCtx, productProfile)

    // ── 9. Log generation for rate limiting + analytics ──
    await adminDb.from("reply_generations").insert({
      user_id: user.id,
      conversation_id,
      replies_count: result.replies.length,
      tokens_used: result.tokens_used,
    })

    logger.info("Reply generation complete", {
      userId: user.id,
      conversationId: conversation_id,
      repliesCount: result.replies.length,
      tokensUsed: result.tokens_used,
      productAlreadyMentioned,
    })

    return NextResponse.json({
      ...result,
      product_already_mentioned: productAlreadyMentioned,
      daily_remaining: DAILY_LIMIT - (dailyCount || 0) - 1,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error("Reply generation failed", { error: message })

    if (message.includes("Could not generate suitable replies")) {
      return NextResponse.json(
        { error: message, code: "GENERATION_FAILED" },
        { status: 422 }
      )
    }

    return NextResponse.json(
      { error: "Reply generation failed. Please try again." },
      { status: 500 }
    )
  }
}
