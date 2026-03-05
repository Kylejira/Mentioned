import OpenAI from "openai"
import { log } from "@/lib/logger"
import type { ProductProfile } from "./website-analyzer"

const logger = log.create("query-discovery-generator")

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type QueryIntent =
  | "recommendation"
  | "alternative"
  | "problem"
  | "comparison"
  | "discovery"

export interface GeneratedQuery {
  query: string
  intent: QueryIntent
  platform_fit: "reddit" | "twitter" | "both"
}

// ---------------------------------------------------------------------------
// OpenAI client (lazy singleton)
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
// LLM Prompt
// ---------------------------------------------------------------------------

function buildQueryGenerationPrompt(profile: ProductProfile): string {
  return `You are an expert at understanding how real people search for software products on Reddit, Twitter, forums, and Q&A sites.

PRODUCT PROFILE:
- Name: ${profile.product_name}
- Category: ${profile.category} / ${profile.subcategory}
- Problem solved: ${profile.problem_solved}
- Target audience: ${profile.target_audience}
- Key features: ${profile.key_features.join(", ")}
- Differentiators: ${profile.differentiators.join(", ")}
- Competitors: ${profile.competitors.join(", ")}
- Keywords: ${profile.keywords.join(", ")}
- Pricing: ${profile.pricing_model}

Generate 25 search queries that REAL PEOPLE would post on Reddit, Twitter/X, or forums when looking for a product like this.

INTENT DISTRIBUTION:
- 8 recommendation queries ("best X for Y", "looking for a tool...")
- 6 alternative queries ("alternatives to [Competitor]", "tools like...")
- 5 problem queries ("how do I...", "I need to...", "struggling with...")
- 4 comparison queries ("X vs Y", "choosing between...")
- 2 discovery queries ("what tools do you use for...")

CRITICAL RULES:
1. Write like a REAL PERSON on Reddit, not like a marketer.
   BAD: "top-rated AI video generation software solutions 2026"
   GOOD: "anyone know a good AI video tool? need something simpler than Runway"

2. Include SPECIFIC details from the product's niche.
   BAD: "best video tool"
   GOOD: "best AI text-to-video tool for making TikToks"

3. Alternative queries MUST name a specific competitor.
   BAD: "alternatives to the leading tool"
   GOOD: "alternatives to Runway for short video clips"

4. Problem queries should describe REAL pain points.
   BAD: "how to make videos"
   GOOD: "I need to make product demo videos but I have zero editing skills"

5. Vary the phrasing. Don't start every query the same way.

6. Include the product's target audience in at least 5 queries.
   (e.g., "for content creators", "for small teams", "for developers")

7. DO NOT include the product name "${profile.product_name}" in any query.
   These queries should sound like someone who DOESN'T know about this product yet.

Respond ONLY with a JSON array. Each item:
{
  "query": "the search query text",
  "intent": "recommendation|alternative|problem|comparison|discovery",
  "platform_fit": "reddit|twitter|both"
}`
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export async function generateDiscoveryQueries(
  profile: ProductProfile
): Promise<GeneratedQuery[]> {
  const openai = getOpenAI()
  const prompt = buildQueryGenerationPrompt(profile)

  logger.info("Generating discovery queries via LLM", {
    product: profile.product_name,
    category: profile.category,
  })

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 3000,
    temperature: 0.8,
  })

  const raw = response.choices[0]?.message?.content || ""
  const jsonStr = raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim()

  let parsed: unknown[]
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    logger.error("Failed to parse LLM query generation response", { raw })
    throw new Error("Failed to parse generated queries from LLM response")
  }

  if (!Array.isArray(parsed)) {
    throw new Error("LLM response is not a JSON array")
  }

  const validIntents = new Set<string>([
    "recommendation",
    "alternative",
    "problem",
    "comparison",
    "discovery",
  ])
  const validPlatforms = new Set<string>(["reddit", "twitter", "both"])

  const queries: GeneratedQuery[] = parsed
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null && typeof (item as any).query === "string"
    )
    .map((item) => ({
      query: (item.query as string).trim(),
      intent: validIntents.has(item.intent as string)
        ? (item.intent as QueryIntent)
        : "recommendation",
      platform_fit: validPlatforms.has(item.platform_fit as string)
        ? (item.platform_fit as "reddit" | "twitter" | "both")
        : "both",
    }))

  logger.info("Discovery queries generated", {
    product: profile.product_name,
    total: queries.length,
    byIntent: {
      recommendation: queries.filter((q) => q.intent === "recommendation").length,
      alternative: queries.filter((q) => q.intent === "alternative").length,
      problem: queries.filter((q) => q.intent === "problem").length,
      comparison: queries.filter((q) => q.intent === "comparison").length,
      discovery: queries.filter((q) => q.intent === "discovery").length,
    },
  })

  return queries
}
