import { OpenAIProvider } from "@/lib/providers"
import { log } from "@/lib/logger"

const logger = log.create("visibility-fix-generator")

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ContentType = "comparison" | "answer_page" | "faq" | "positioning"

export interface GeneratedContent {
  title: string
  body: string
  metadata: Record<string, unknown>
}

export interface ComparisonInput {
  brandName: string
  category: string
  differentiators: string[]
  targetAudience: string
  competitorName: string
  competitorReasons: string[]
  competitorMentionRate: number
}

export interface AnswerPageInput {
  queryText: string
  brandName: string
  problemSolved: string
  differentiators: string[]
  targetAudience: string
  competitors: Array<{ name: string; reason: string }>
}

export interface FAQInput {
  brandName: string
  category: string
  problemSolved: string
  differentiators: string[]
  missedQueries: string[]
  competitorPositioning: Array<{ name: string; topReasons: string[] }>
}

export interface PositioningInput {
  brandName: string
  category: string
  score: number
  competitors: Array<{ name: string; mentions: number; topReasons: string[] }>
  gaps: string[]
}

// ---------------------------------------------------------------------------
// LLM providers (lazy-initialized singletons)
// ---------------------------------------------------------------------------

let _gpt4o: OpenAIProvider | null = null
let _gpt4oMini: OpenAIProvider | null = null

function getGpt4o(): OpenAIProvider {
  if (!_gpt4o) {
    _gpt4o = new OpenAIProvider({ model: "gpt-4o", maxTokens: 3000, temperature: 0.7 })
  }
  return _gpt4o
}

function getGpt4oMini(): OpenAIProvider {
  if (!_gpt4oMini) {
    _gpt4oMini = new OpenAIProvider({ model: "gpt-4o-mini", maxTokens: 2000, temperature: 0.7 })
  }
  return _gpt4oMini
}

// ---------------------------------------------------------------------------
// 1. Comparison Page Generator (spec section 3.1)
// ---------------------------------------------------------------------------

export async function generateComparisonPage(input: ComparisonInput): Promise<GeneratedContent> {
  const {
    brandName, category, differentiators, targetAudience,
    competitorName, competitorReasons, competitorMentionRate,
  } = input

  const prompt = `You are a product marketing expert writing a comparison page for a SaaS product's website.

USER'S PRODUCT:
- Name: ${brandName}
- Category: ${category}
- Key differentiators: ${differentiators.join(", ")}
- Target audience: ${targetAudience}

COMPETITOR:
- Name: ${competitorName}
- How AI describes them: ${competitorReasons.join(", ")}
- Their mention rate in AI: ${competitorMentionRate}%

Generate a comparison page with this EXACT structure:

# ${brandName} vs ${competitorName}: Which Is Better for ${targetAudience}?

## Quick Summary
[2-3 sentence overview positioning both products fairly]

## Feature Comparison
[Table format: Feature | ${brandName} | ${competitorName}]
[Include 6-8 key features relevant to the category]

## Best For
### When to Choose ${brandName}
[3-4 bullet points]
### When to Choose ${competitorName}
[3-4 bullet points]

## Pricing
[Brief pricing comparison if known, otherwise note to fill in]

## The Verdict
[2-3 sentences giving balanced recommendation]

RULES:
1. Be FAIR and balanced. Don't be salesy for the user's product.
2. Use structured headings (H1, H2, H3) consistently.
3. Include bullet points and tables — AI models extract these easily.
4. Keep paragraphs short (2-3 sentences max).
5. Write at an 8th grade reading level.
6. Naturally include the category name multiple times.
7. Output as Markdown.`

  logger.info("Generating comparison page", { brandName, competitorName })

  const body = await getGpt4o().generateResponse(prompt)

  return {
    title: `${brandName} vs ${competitorName}: Which Is Better for ${targetAudience}?`,
    body,
    metadata: {
      type: "comparison",
      competitor_name: competitorName,
      competitor_mention_rate: competitorMentionRate,
      model: "gpt-4o",
    },
  }
}

// ---------------------------------------------------------------------------
// 2. Buyer Answer Page Generator (spec section 3.2)
// ---------------------------------------------------------------------------

export async function generateAnswerPage(input: AnswerPageInput): Promise<GeneratedContent> {
  const {
    queryText, brandName, problemSolved, differentiators,
    targetAudience, competitors,
  } = input

  const competitorList = competitors
    .map((c) => `- ${c.name}: ${c.reason || "no specific reason"}`)
    .join("\n")

  const prompt = `You are a product category expert writing a comprehensive answer to a buyer's question.

BUYER QUESTION: "${queryText}"

USER'S PRODUCT:
- Name: ${brandName}
- What it does: ${problemSolved}
- Key strengths: ${differentiators.join(", ")}
- Target audience: ${targetAudience}

COMPETITORS AI CURRENTLY RECOMMENDS FOR THIS QUERY:
${competitorList}

Generate an answer page with this EXACT structure:

# ${queryText}

## Short Answer
[2-3 sentence direct answer to the question, mentioning top options including ${brandName}]

## Top Options Compared
[For each option including ${brandName}, write 2-3 sentences explaining why it's good for this use case. Include the user's product in the top 3, positioned naturally among competitors.]

## How to Choose
[Decision framework: what to consider when picking a tool for this need]

## FAQ
[3-4 related questions with brief answers]

RULES:
1. ${brandName} should appear in the top 3 recommendations but NOT #1. Placing it #2 or #3 feels more credible than #1.
2. Be genuinely helpful — this should be useful content, not an ad.
3. Include the exact query text in H1 and naturally in the content.
4. Use structured headings, bullets, and short paragraphs.
5. Output as Markdown.`

  logger.info("Generating answer page", { brandName, queryText: queryText.slice(0, 60) })

  const body = await getGpt4o().generateResponse(prompt)

  return {
    title: queryText,
    body,
    metadata: {
      type: "answer_page",
      query_text: queryText,
      competitors: competitors.map((c) => c.name),
      model: "gpt-4o",
    },
  }
}

// ---------------------------------------------------------------------------
// 3. FAQ Set Generator (spec section 3.3)
// ---------------------------------------------------------------------------

export async function generateFAQSet(input: FAQInput): Promise<GeneratedContent> {
  const {
    brandName, category, problemSolved, differentiators,
    missedQueries, competitorPositioning,
  } = input

  const missedList = missedQueries.map((q) => `- "${q}"`).join("\n")
  const competitorList = competitorPositioning
    .map((c) => `- ${c.name}: ${c.topReasons.join(", ")}`)
    .join("\n")

  const prompt = `Generate a set of FAQ entries for a product website.

PRODUCT:
- Name: ${brandName}
- Category: ${category}
- What it does: ${problemSolved}
- Key strengths: ${differentiators.join(", ")}

MISSED BUYER QUERIES (brand was NOT recommended for these):
${missedList}

COMPETITOR POSITIONING (what AI says about competitors):
${competitorList}

Generate 8 FAQ entries. Each entry:

Q: [Question a buyer might ask that relates to the missed queries above]
A: [Clear, concise 2-4 sentence answer that naturally positions ${brandName} as a strong option. Reference specific strengths. Do NOT be salesy. Be informative.]

RULES:
1. Questions should match real buyer language (how they'd ask AI).
2. Answers should be factual and balanced.
3. At least 3 FAQs should directly address a missed query topic.
4. At least 2 FAQs should address competitor comparison topics.
5. Each answer should be 2-4 sentences, suitable for schema.org FAQPage.
6. Output as JSON array: [{"question": "...", "answer": "..."}]`

  logger.info("Generating FAQ set", { brandName, missedQueryCount: missedQueries.length })

  const raw = await getGpt4oMini().generateResponse(prompt)

  let faqEntries: Array<{ question: string; answer: string }> = []
  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      faqEntries = JSON.parse(jsonMatch[0])
    }
  } catch {
    logger.warn("Failed to parse FAQ JSON, returning raw markdown")
  }

  const bodyMarkdown = faqEntries.length > 0
    ? faqEntries.map((e) => `## ${e.question}\n\n${e.answer}`).join("\n\n")
    : raw

  return {
    title: `${brandName} FAQ: Common Questions About ${category}`,
    body: bodyMarkdown,
    metadata: {
      type: "faq",
      faq_count: faqEntries.length || 0,
      faq_entries: faqEntries,
      missed_queries_used: missedQueries.length,
      model: "gpt-4o-mini",
    },
  }
}

// ---------------------------------------------------------------------------
// 4. Positioning Brief Generator (spec section 3.4)
// ---------------------------------------------------------------------------

export async function generatePositioningBrief(input: PositioningInput): Promise<GeneratedContent> {
  const { brandName, category, score, competitors, gaps } = input

  const competitorList = competitors
    .map((c) => `${c.name} (mentioned ${c.mentions}x): Known for ${c.topReasons.join(", ")}`)
    .join("\n")

  const prompt = `You are a positioning strategist.

Based on the competitor analysis below, generate specific messaging recommendations for the product to improve its AI visibility.

PRODUCT: ${brandName}
CATEGORY: ${category}
CURRENT AI VISIBILITY: ${score}/100

COMPETITOR POSITIONING IN AI MODELS:
${competitorList}

UNCLAIMED POSITIONING GAPS:
${gaps.join("\n")}

Generate 5-7 specific, actionable positioning recommendations. Each recommendation should include:
1. What to emphasize (specific messaging angle)
2. Why it matters (what gap it fills)
3. Where to implement it (website copy, docs, about page, etc.)
4. Example sentence the user can adapt

Output as JSON array:
[{"recommendation": "...", "why": "...", "where": "...", "example": "..."}]`

  logger.info("Generating positioning brief", { brandName, score })

  const raw = await getGpt4oMini().generateResponse(prompt)

  let recommendations: Array<{ recommendation: string; why: string; where: string; example: string }> = []
  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      recommendations = JSON.parse(jsonMatch[0])
    }
  } catch {
    logger.warn("Failed to parse positioning JSON, returning raw markdown")
  }

  const bodyMarkdown = recommendations.length > 0
    ? recommendations
        .map((r, i) =>
          `### ${i + 1}. ${r.recommendation}\n\n**Why:** ${r.why}\n\n**Where:** ${r.where}\n\n**Example:** *"${r.example}"*`
        )
        .join("\n\n---\n\n")
    : raw

  return {
    title: `AI Visibility Positioning Brief: ${brandName}`,
    body: bodyMarkdown,
    metadata: {
      type: "positioning",
      recommendation_count: recommendations.length || 0,
      recommendations,
      current_score: score,
      competitor_count: competitors.length,
      model: "gpt-4o-mini",
    },
  }
}

// ---------------------------------------------------------------------------
// Unified generator (spec section 5.2)
// ---------------------------------------------------------------------------

export async function generateContent(
  type: ContentType,
  opportunityData: Record<string, unknown>,
  profile: Record<string, unknown>,
  summary: Record<string, unknown>,
): Promise<GeneratedContent> {
  const brandName = (profile.brand_name as string) || "Your Product"
  const category = (profile.category as string) || (profile.subcategory as string) || ""
  const differentiators = [
    ...((profile.key_differentiators as string[]) || []),
    ...(profile.user_differentiators ? [profile.user_differentiators as string] : []),
  ].filter(Boolean)
  const targetAudience = (profile.target_audience as string) || (profile.target_buyer as string) || ""
  const problemSolved = (profile.core_problem as string) || ""

  const competitorReasons = (summary.competitor_reasons as Record<string, unknown>) || {}
  const competitorEntries = (competitorReasons.competitors as Array<Record<string, unknown>>) || []

  switch (type) {
    case "comparison": {
      const compName = (opportunityData.competitor_name as string) || ""
      const compEntry = competitorEntries.find(
        (c) => (c.name as string)?.toLowerCase() === compName.toLowerCase()
      )
      const reasons = compEntry
        ? ((compEntry.reasons as Array<{ reason: string }>) || []).map((r) => r.reason)
        : []

      return generateComparisonPage({
        brandName,
        category,
        differentiators,
        targetAudience,
        competitorName: compName,
        competitorReasons: reasons.length > 0 ? reasons : ["popular alternative"],
        competitorMentionRate: (opportunityData.competitor_mentions as number) || 0,
      })
    }

    case "answer_page": {
      const queryText = (opportunityData.query_text as string) || ""
      const compNames = (opportunityData.competitors_in_response as string[]) || []
      const competitors = compNames.map((name) => {
        const entry = competitorEntries.find(
          (c) => (c.name as string)?.toLowerCase() === name.toLowerCase()
        )
        const topReason = entry
          ? ((entry.reasons as Array<{ reason: string }>) || [])[0]?.reason || ""
          : ""
        return { name, reason: topReason }
      })

      return generateAnswerPage({
        queryText,
        brandName,
        problemSolved: problemSolved || `${brandName} is a ${category} solution`,
        differentiators,
        targetAudience,
        competitors,
      })
    }

    case "faq": {
      const missedQueries = (opportunityData.missed_queries as string[]) || []
      const competitorPositioning = competitorEntries.slice(0, 5).map((c) => ({
        name: (c.name as string) || "",
        topReasons: ((c.reasons as Array<{ reason: string }>) || [])
          .slice(0, 3)
          .map((r) => r.reason),
      }))

      return generateFAQSet({
        brandName,
        category,
        problemSolved: problemSolved || `${brandName} is a ${category} solution`,
        differentiators,
        missedQueries,
        competitorPositioning,
      })
    }

    case "positioning": {
      const gaps = (opportunityData.gaps as string[]) || []
      const competitors = competitorEntries.slice(0, 5).map((c) => ({
        name: (c.name as string) || "",
        mentions: (c.total_mentions as number) || 0,
        topReasons: ((c.reasons as Array<{ reason: string }>) || [])
          .slice(0, 3)
          .map((r) => r.reason),
      }))

      const score = (summary.opportunity as Record<string, unknown>)
        ? 0
        : 0
      const scanScore = (opportunityData.score as number) || score

      return generatePositioningBrief({
        brandName,
        category,
        score: scanScore,
        competitors,
        gaps,
      })
    }

    default:
      throw new Error(`Unknown content type: ${type}`)
  }
}
