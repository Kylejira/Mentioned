import OpenAI from "openai"
import { log } from "@/lib/logger"
import { validateReply, STRICTER_PROMPT_ADDENDUM } from "./reply-validator"

const logger = log.create("reply-generator")

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProductProfile {
  product_name: string
  one_liner: string
  description: string | null
  key_features: string[]
  target_audience: string | null
  use_cases: string[]
  competitors: string[]
  website_url: string | null
  preferred_tone: "casual" | "professional" | "helpful" | "expert"
  custom_instructions: string | null
}

export interface ConversationContext {
  id: string
  platform: string
  title: string | null
  text: string
  full_thread_text?: string | null
  url?: string | null
}

export interface GeneratedReply {
  text: string
  mentions_product: boolean
  approach: string
  validation: { passed: boolean; issues: string[] }
}

export interface ReplyGenerationResult {
  replies: GeneratedReply[]
  conversation_id: string
  generated_at: string
  tokens_used: number
}

// ---------------------------------------------------------------------------
// OpenAI singleton
// ---------------------------------------------------------------------------

let _openai: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured")
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _openai
}

// ---------------------------------------------------------------------------
// Tone modifiers
// ---------------------------------------------------------------------------

const TONE_MODIFIERS: Record<string, string> = {
  casual:
    `Write like you're chatting with a friend on Reddit. Short sentences, informal. Use 'tbh', 'imo', 'honestly'.`,
  professional:
    `Write in a clear, structured way. Use proper grammar. No slang.`,
  helpful:
    `Focus on genuinely solving the person's problem. Be warm but not salesy. Share from experience.`,
  expert:
    `Show deep knowledge of the category. Reference specific features and trade-offs.`,
}

// ---------------------------------------------------------------------------
// Build prompt
// ---------------------------------------------------------------------------

export function buildReplyPrompt(
  conversation: ConversationContext,
  profile: ProductProfile,
  isStricter = false
): string {
  const existingReplies = conversation.full_thread_text
    ? conversation.full_thread_text.slice(0, 3000)
    : null

  const toneModifier = TONE_MODIFIERS[profile.preferred_tone] || TONE_MODIFIERS.helpful

  const stricterAddendum = isStricter ? STRICTER_PROMPT_ADDENDUM : ""

  // Edge case: image/video-only threads with minimal text
  const isImageOnly = conversation.text.trim().length < 20 && conversation.title
  const imageOnlyNote = isImageOnly
    ? "\nNote: the original post is an image/video, so only the title provides context. Keep the reply brief and focused on the title.\n"
    : ""

  // Edge case: heavily-replied threads
  const replyCount = conversation.full_thread_text
    ? (conversation.full_thread_text.match(/\n/g) || []).length
    : 0
  const manyRepliesNote = replyCount > 50
    ? "\nThis thread already has many replies. Keep your response concise and add a unique angle to stand out.\n"
    : ""

  return `You are helping a SaaS founder write a genuine, helpful reply to an online conversation. The reply should provide real value and may subtly mention their product.

CONVERSATION CONTEXT:
Platform: ${conversation.platform}
Thread title: ${conversation.title || "(no title)"}
Original post: ${isImageOnly ? "(image/video post — see title above)" : conversation.text.slice(0, 4000)}
${existingReplies ? `Existing replies:\n${existingReplies}` : ""}
${imageOnlyNote}${manyRepliesNote}

USER'S PRODUCT:
Name: ${profile.product_name}
What it does: ${profile.one_liner}
${profile.description ? `Description: ${profile.description}` : ""}
Key features: ${profile.key_features.join(", ") || "N/A"}
Best for: ${profile.target_audience || "general audience"}
${profile.website_url ? `Website: ${profile.website_url}` : ""}

TONE: ${toneModifier}
${profile.custom_instructions ? `CUSTOM STYLE NOTES: ${profile.custom_instructions}` : ""}
${stricterAddendum}
Generate 3 reply variations. Each must follow these rules:

STRUCTURE RULES:
1. Start by answering the question or addressing the problem directly.
2. Recommend 1-2 well-known tools that genuinely fit the request (even if they are competitors).
3. Then naturally introduce ${profile.product_name} as an additional option with ONE specific reason why it fits this particular request.
4. Keep the product mention to 1-2 sentences maximum.
5. Close conversationally. NO call-to-action like "check it out!" or "visit our website!". Just end naturally.

NATURALNESS RULES:
1. Write like a real ${conversation.platform} user. Match the platform's casual tone.
   Reddit: informal, use "honestly", "imo", "fwiw", short paragraphs.
   Twitter: concise, direct, use thread-appropriate language.
   Forum: slightly more structured but still conversational.
2. NEVER use marketing language. No: "powerful", "revolutionary", "game-changing", "cutting-edge", "seamless", "unlock", "leverage".
3. NEVER use exclamation marks when mentioning the product.
4. Use lowercase for the product name if the platform culture does that.
5. Include a minor imperfection or caveat about the product. Example: "it's still pretty new but" or "not perfect for everything but" or "depending on your use case". This makes it feel real.
6. Vary sentence length. Mix short and longer sentences.

VARIATION RULES:
- Variation 1: Helpful reply WITH product mention (product in middle)
- Variation 2: Helpful reply WITH product mention (product at end)
- Variation 3: Pure helpful reply WITHOUT any product mention (genuinely just answer the question with other tools)

BANNED PHRASES (never use these):
- "I'd recommend checking out"
- "You should definitely try"
- "[Product] is a great tool that"
- "Full disclosure" or "disclaimer"
- "I'm affiliated with" or "I work for"
- Any URL unless the platform expects links in replies

Respond as JSON:
{
  "replies": [
    {
      "text": "the reply text",
      "mentions_product": true,
      "approach": "helpful with mid-reply mention"
    },
    {
      "text": "the reply text",
      "mentions_product": true,
      "approach": "helpful with end mention"
    },
    {
      "text": "the reply text",
      "mentions_product": false,
      "approach": "pure helpful — no product mention"
    }
  ]
}`
}

// ---------------------------------------------------------------------------
// Parse LLM JSON response
// ---------------------------------------------------------------------------

interface RawReply {
  text: string
  mentions_product: boolean
  approach: string
}

function parseReplyResponse(raw: string): { replies: RawReply[] } {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim()

  try {
    const parsed = JSON.parse(cleaned)
    if (!parsed.replies || !Array.isArray(parsed.replies)) {
      throw new Error("Missing replies array")
    }
    return {
      replies: parsed.replies.map((r: any) => ({
        text: String(r.text || ""),
        mentions_product: Boolean(r.mentions_product),
        approach: String(r.approach || ""),
      })),
    }
  } catch (err) {
    logger.error("Failed to parse reply JSON", { error: String(err), raw: raw.slice(0, 500) })
    throw new Error("Failed to parse LLM response")
  }
}

// ---------------------------------------------------------------------------
// Generate replies (main entry point)
// ---------------------------------------------------------------------------

export async function generateReplies(
  conversation: ConversationContext,
  profile: ProductProfile,
  toneOverride?: string
): Promise<ReplyGenerationResult> {
  const effectiveProfile = toneOverride
    ? { ...profile, preferred_tone: toneOverride as ProductProfile["preferred_tone"] }
    : profile

  const openai = getOpenAI()

  // First attempt
  const prompt = buildReplyPrompt(conversation, effectiveProfile, false)

  logger.info("Generating replies", {
    conversationId: conversation.id,
    platform: conversation.platform,
    tone: effectiveProfile.preferred_tone,
  })

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.85,
    max_tokens: 2000,
    response_format: { type: "json_object" },
  })

  const rawContent = response.choices[0]?.message?.content
  if (!rawContent) throw new Error("Empty LLM response")

  const tokensUsed =
    (response.usage?.prompt_tokens || 0) + (response.usage?.completion_tokens || 0)

  let parsed: { replies: RawReply[] }
  try {
    parsed = parseReplyResponse(rawContent)
  } catch {
    // Retry once on unparseable JSON
    logger.warn("JSON parse failed, retrying once")
    const retryParseResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    })
    const retryRaw = retryParseResponse.choices[0]?.message?.content
    if (!retryRaw) throw new Error("Generation failed. Please try again.")
    parsed = parseReplyResponse(retryRaw)
  }

  // Validate each reply
  let validated: GeneratedReply[] = parsed.replies.map((r) => ({
    ...r,
    validation: validateReply(r.text, profile.product_name),
  }))

  const passed = validated.filter((r) => r.validation.passed)
  const failed = validated.filter((r) => !r.validation.passed)

  if (failed.length > 0) {
    logger.warn("Some replies failed validation", {
      failedCount: failed.length,
      issues: failed.map((r) => r.validation.issues),
    })
  }

  // If 2+ failed, retry with stricter prompt
  if (passed.length < 2 && failed.length > 0) {
    logger.info("Retrying with stricter prompt", {
      passedCount: passed.length,
      failedCount: failed.length,
    })

    const strictPrompt = buildReplyPrompt(conversation, effectiveProfile, true)

    const retryResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: strictPrompt }],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    })

    const retryContent = retryResponse.choices[0]?.message?.content
    if (retryContent) {
      const retryParsed = parseReplyResponse(retryContent)
      const retryValidated = retryParsed.replies.map((r) => ({
        ...r,
        validation: validateReply(r.text, profile.product_name),
      }))

      const retryPassed = retryValidated.filter((r) => r.validation.passed)

      if (retryPassed.length > passed.length) {
        validated = retryValidated
      }
    }
  }

  let finalReplies = validated
    .filter((r) => r.validation.passed)
    .slice(0, 3)

  // If all failed, try to salvage the no-product-mention variation
  if (finalReplies.length === 0) {
    const noMention = validated.find((r) => !r.mentions_product)
    if (noMention) {
      logger.warn("All product-mention replies failed. Falling back to no-mention variation.", {
        conversationId: conversation.id,
      })
      finalReplies = [{
        ...noMention,
        validation: { passed: true, issues: [] },
        approach: "pure helpful — no product mention (fallback)",
      }]
    } else {
      logger.error("All replies failed validation after retry", {
        conversationId: conversation.id,
      })
      throw new Error(
        "This conversation may not be a good fit for your product. Try a different thread."
      )
    }
  }

  logger.info("Replies generated", {
    conversationId: conversation.id,
    count: finalReplies.length,
    tokensUsed,
  })

  return {
    replies: finalReplies,
    conversation_id: conversation.id,
    generated_at: new Date().toISOString(),
    tokens_used: tokensUsed,
  }
}
