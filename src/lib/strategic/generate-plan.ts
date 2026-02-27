import Anthropic from "@anthropic-ai/sdk"
import { createAdminClient } from "@/lib/supabase-admin"
import { log } from "@/lib/logger"

const logger = log.create("strategic-plan")

// ── Types ──

export interface VisibilityBreakdown {
  overallScore: number
  mentionRate: number
  chatgptScore: number | null
  claudeScore: number | null
  avgPosition: number | null
}

export interface CompetitiveGap {
  competitor: string
  theirScore: number
  yourScore: number
  gapDescription: string
}

export interface Opportunity {
  title: string
  description: string
  impact: "high" | "medium" | "low"
  effort: "high" | "medium" | "low"
}

export interface RoadmapItem {
  week: 1 | 2 | 3 | 4
  task: string
  priority: "critical" | "high" | "medium"
  category: string
}

export interface ContentRecommendation {
  type: "comparison" | "guide" | "faq" | "landing-page" | "blog"
  title: string
  reason: string
  priority: "critical" | "high" | "medium"
}

export interface StrategicPlan {
  executiveSummary: string
  visibilityBreakdown: VisibilityBreakdown
  competitiveGaps: CompetitiveGap[]
  opportunities: Opportunity[]
  roadmap30Days: RoadmapItem[]
  contentRecommendations: ContentRecommendation[]
}

// ── Strategic Input (assembled from DB) ──

export interface CompetitorEntry {
  name: string
  mentioned: boolean
  mentionCount: number
  totalQueries: number
  outranksUser: boolean
}

export interface QueryResult {
  query: string
  chatgpt: boolean
  claude: boolean
}

export interface StrategicInput {
  brand: string
  brandUrl: string
  industry: string
  description: string
  competitors: string[]
  totalQueries: number
  mentionRate: number
  scores: {
    overall: number
    chatgptMentionRate: number
    claudeMentionRate: number
    modelConsistency: number
  }
  competitorBreakdown: CompetitorEntry[]
  queryResults: QueryResult[]
  rawResponses: { query: string; chatgpt_response: string | null; claude_response: string | null }[]
}

// ── Data fetching ──

async function fetchStrategicInput(scanId: string): Promise<StrategicInput | null> {
  const db = createAdminClient()

  const { data: scan, error: scanError } = await db
    .from("scans")
    .select("id, score, score_breakdown, saas_profile, query_count, scan_version")
    .eq("id", scanId)
    .single()

  if (scanError || !scan) {
    logger.error("Scan not found", { scanId, error: scanError?.message })
    return null
  }

  const profile = (scan.saas_profile || {}) as Record<string, unknown>
  const scoreBreakdown = (scan.score_breakdown || {}) as Record<string, unknown>
  const brandUrl = (profile.website_url as string) || ""

  let fullResult: Record<string, unknown> | null = null
  if (brandUrl) {
    const { data: history } = await db
      .from("scan_history")
      .select("full_result")
      .eq("product_url", brandUrl)
      .order("scanned_at", { ascending: false })
      .limit(1)
      .single()

    fullResult = (history?.full_result as Record<string, unknown>) || null
  }

  const competitorResults = (fullResult?.competitor_results || []) as CompetitorEntry[]
  const queriesTested = (fullResult?.queries_tested || []) as QueryResult[]
  const rawResponses = (fullResult?.raw_responses || []) as { query: string; chatgpt_response: string | null; claude_response: string | null }[]

  const visibilityScore = (fullResult?.visibilityScore || {}) as Record<string, unknown>
  const byModel = (visibilityScore?.byModel || {}) as Record<string, number>
  const breakdown = (visibilityScore?.breakdown || {}) as Record<string, unknown>

  return {
    brand: (profile.brand_name as string) || "",
    brandUrl,
    industry: (profile.category as string) || "",
    description: (profile.tagline as string) || "",
    competitors: (profile.competitors_mentioned as string[]) || [],
    totalQueries: (scan.query_count as number) || 0,
    mentionRate: (scoreBreakdown.mention_rate as number) || 0,
    scores: {
      overall: (scan.score as number) || 0,
      chatgptMentionRate: byModel.chatgpt || 0,
      claudeMentionRate: byModel.claude || 0,
      modelConsistency: (breakdown.modelConsistency as number) || 0,
    },
    competitorBreakdown: competitorResults,
    queryResults: queriesTested,
    rawResponses,
  }
}

// ── Prompt construction ──

const SYSTEM_PROMPT = `You are an AI visibility strategist helping SaaS brands improve their presence in AI-generated responses from models like ChatGPT and Claude.

You analyze scan data — including mention rates, competitor performance, query results, and raw AI responses — and produce actionable strategic plans.

You MUST respond with valid JSON matching the exact schema requested. No markdown, no code fences, just raw JSON.

Your response MUST include an "actions" array with 5-8 scored action items following these guidelines:

SCORING GUIDELINES:
- impact_score 8-10: Actions that directly affect mention probability (FAQ pages, comparison content, schema markup)
- impact_score 5-7: Actions that indirectly help (authority building, link earning)
- impact_score 1-4: Nice-to-have improvements with uncertain impact
- effort_score 1-3: Can be done in under 2 hours
- effort_score 4-6: Half day to full day of work
- effort_score 7-10: Multi-day projects or require external dependencies

CATEGORY GUIDELINES:
- content: Creating or improving website content (FAQs, comparisons, use case pages)
- technical: Schema markup, site structure, metadata optimization
- authority: Backlinks, mentions on third-party sites, review platforms
- positioning: Messaging, differentiation, value proposition clarity

Return 5-8 actions. Be specific to the data provided. No generic advice.`

function buildUserPrompt(input: StrategicInput): string {
  const trimmedResponses = input.rawResponses.slice(0, 10).map((r) => ({
    query: r.query,
    chatgpt: r.chatgpt_response ? r.chatgpt_response.slice(0, 300) : null,
    claude: r.claude_response ? r.claude_response.slice(0, 300) : null,
  }))

  return `Analyze this AI visibility scan and produce a strategic improvement plan.

## Scan Data

${JSON.stringify({
  brand: input.brand,
  website: input.brandUrl,
  industry: input.industry,
  description: input.description,
  competitors: input.competitors,
  totalQueries: input.totalQueries,
  mentionRate: input.mentionRate,
  scores: input.scores,
  competitorBreakdown: input.competitorBreakdown,
  queryResults: input.queryResults,
  sampleResponses: trimmedResponses,
}, null, 2)}

## Instructions

Return a JSON object with this exact structure:

{
  "executiveSummary": "A 2-3 sentence overview of the brand's current AI visibility, key strengths, and most urgent gap.",
  "visibilityBreakdown": "A paragraph explaining the score breakdown: how the brand performs on ChatGPT vs Claude, which query types it appears in, and where it's missing.",
  "competitiveGaps": [
    "One sentence per competitor gap, e.g. 'Competitor X is mentioned in 80% of project management queries while you appear in only 20%.'"
  ],
  "opportunities": [
    "One sentence per opportunity, e.g. 'Create a comparison page targeting [query type] to increase visibility in head-to-head recommendations.'"
  ],
  "roadmap30Days": [
    "One actionable task per item, ordered by priority, e.g. 'Week 1: Publish a detailed comparison page vs [top competitor].'"
  ],
  "contentRecommendations": [
    "One specific content piece to create, e.g. 'Write a guide titled: Best [category] Tools for [target buyer] — include benchmarks and use cases.'"
  ],
  "actions": [
    {
      "title": "string - concise action title (max 80 chars)",
      "description": "string - specific implementation guidance (2-3 sentences)",
      "impact_score": "number 1-10 (10 = maximum visibility improvement)",
      "effort_score": "number 1-10 (1 = trivial, 10 = major project)",
      "category": "content | technical | authority | positioning",
      "timeline": "immediate | this_week | this_month | this_quarter"
    }
  ],
  "reasoning": "2-3 paragraphs explaining your analysis of the brand's AI visibility and why you recommended these specific actions."
}

Return 5-8 items in the "actions" array. Be specific to this brand, its industry, and the actual scan data. Reference real competitor names, actual query gaps, and concrete content ideas. Do not be generic.`
}

// ── AI call ──

async function callClaude(systemPrompt: string, userPrompt: string): Promise<string> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const res = await anthropic.messages.create({
    model: "claude-3-haiku-20240307",
    max_tokens: 2000,
    temperature: 0.4,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  })

  const textBlock = res.content.find((b) => b.type === "text")
  return textBlock?.type === "text" ? textBlock.text : ""
}

// ── Response parsing ──

interface ParsedPlanResult {
  plan: StrategicPlan
  actions: ProcessedAction[]
  reasoning: string
}

function parseStrategicResponse(raw: string): ParsedPlanResult | null {
  try {
    let cleaned = raw.trim()
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenceMatch) cleaned = fenceMatch[1].trim()

    const parsed = JSON.parse(cleaned)

    const plan: StrategicPlan = {
      executiveSummary: typeof parsed.executiveSummary === "string" ? parsed.executiveSummary : "",
      visibilityBreakdown: parseVisibilityBreakdown(parsed.visibilityBreakdown),
      competitiveGaps: parseStringArray(parsed.competitiveGaps).map((gap) => ({
        competitor: "",
        theirScore: 0,
        yourScore: 0,
        gapDescription: gap,
      })),
      opportunities: parseStringArray(parsed.opportunities).map((opp) => ({
        title: opp,
        description: "",
        impact: "medium" as const,
        effort: "medium" as const,
      })),
      roadmap30Days: parseStringArray(parsed.roadmap30Days).map((task, i) => ({
        week: (Math.min(Math.floor(i / 2) + 1, 4)) as 1 | 2 | 3 | 4,
        task,
        priority: i < 2 ? "critical" as const : i < 5 ? "high" as const : "medium" as const,
        category: "visibility",
      })),
      contentRecommendations: parseStringArray(parsed.contentRecommendations).map((rec) => ({
        type: "guide" as const,
        title: rec,
        reason: "",
        priority: "high" as const,
      })),
    }

    const rawActions = Array.isArray(parsed.actions) ? parsed.actions : []
    const actions = rawActions.length > 0 ? processActions(rawActions) : fallbackActions()
    const reasoning = typeof parsed.reasoning === "string" ? parsed.reasoning : ""

    return { plan, actions, reasoning }
  } catch (err) {
    logger.error("Failed to parse strategic plan response", { error: String(err), rawLength: raw.length })
    return null
  }
}

function parseVisibilityBreakdown(value: unknown): VisibilityBreakdown {
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>
    return {
      overallScore: typeof obj.overallScore === "number" ? obj.overallScore : 0,
      mentionRate: typeof obj.mentionRate === "number" ? obj.mentionRate : 0,
      chatgptScore: typeof obj.chatgptScore === "number" ? obj.chatgptScore : null,
      claudeScore: typeof obj.claudeScore === "number" ? obj.claudeScore : null,
      avgPosition: typeof obj.avgPosition === "number" ? obj.avgPosition : null,
    }
  }
  return { overallScore: 0, mentionRate: 0, chatgptScore: null, claudeScore: null, avgPosition: null }
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string")
  return []
}

// ── Action processing ──

export interface ProcessedAction {
  id: string
  title: string
  description: string
  impact_score: number
  effort_score: number
  priority_score: number
  category: "content" | "technical" | "authority" | "positioning"
  timeline: string
  badges: string[]
}

const VALID_CATEGORIES = ["content", "technical", "authority", "positioning"] as const

function processActions(rawActions: unknown[]): ProcessedAction[] {
  return rawActions.map((a: any) => {
    const impact = Math.min(10, Math.max(1, Math.round(a.impact_score || 5)))
    const effort = Math.min(10, Math.max(1, Math.round(a.effort_score || 5)))
    const priority = Math.round((impact / effort) * 100) / 100

    const badges: string[] = []
    if (impact >= 7 && effort <= 3) badges.push("quick_win")
    if (impact >= 8) badges.push("high_impact")

    return {
      id: crypto.randomUUID(),
      title: (typeof a.title === "string" ? a.title : "Review your visibility data").slice(0, 80),
      description: typeof a.description === "string" ? a.description : "",
      impact_score: impact,
      effort_score: effort,
      priority_score: priority,
      category: VALID_CATEGORIES.includes(a.category) ? a.category : "content",
      timeline: a.timeline || "this_week",
      badges,
    } satisfies ProcessedAction
  }).sort((a, b) => b.priority_score - a.priority_score)
}

function fallbackActions(): ProcessedAction[] {
  return [{
    id: crypto.randomUUID(),
    title: "Review your scan results for improvement opportunities",
    description: "Check your visibility score breakdown and competitor data to identify areas for optimization.",
    impact_score: 5,
    effort_score: 1,
    priority_score: 5,
    category: "content",
    timeline: "immediate",
    badges: [],
  }]
}

// ── Persistence ──

async function persistPlan(
  scanId: string,
  plan: StrategicPlan,
  actions: ProcessedAction[],
  reasoning: string,
): Promise<boolean> {
  try {
    const db = createAdminClient()

    const { error } = await db.from("action_plans").upsert(
      {
        scan_id: scanId,
        executive_summary: plan.executiveSummary,
        visibility_breakdown: plan.visibilityBreakdown,
        competitive_gaps: plan.competitiveGaps,
        opportunities: plan.opportunities,
        roadmap_30_days: plan.roadmap30Days,
        content_recommendations: plan.contentRecommendations,
        actions,
        reasoning,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "scan_id" }
    )

    if (error) {
      logger.error("Failed to persist action plan", { scanId, error: error.message })
      return false
    }

    logger.info("Action plan persisted", { scanId, actionCount: actions.length })
    return true
  } catch (err) {
    logger.error("Exception persisting action plan", { scanId, error: String(err) })
    return false
  }
}

// ── Main function ──

export interface GeneratePlanResult {
  plan: StrategicPlan
  persisted: boolean
}

export async function generateStrategicPlan(scanId: string): Promise<GeneratePlanResult> {
  logger.info("Generating strategic plan", { scanId })

  const strategicInput = await fetchStrategicInput(scanId)

  if (!strategicInput) {
    logger.error("Could not fetch strategic input", { scanId })
    return { plan: emptyPlan(), persisted: false }
  }

  logger.info("Strategic input assembled", {
    scanId,
    brand: strategicInput.brand,
    industry: strategicInput.industry,
    totalQueries: strategicInput.totalQueries,
    mentionRate: strategicInput.mentionRate,
    overallScore: strategicInput.scores.overall,
    competitors: strategicInput.competitors.length,
    queryResults: strategicInput.queryResults.length,
    rawResponses: strategicInput.rawResponses.length,
    competitorBreakdown: strategicInput.competitorBreakdown.length,
  })

  if (!process.env.ANTHROPIC_API_KEY) {
    logger.error("ANTHROPIC_API_KEY not configured, returning empty plan")
    return { plan: emptyPlan(), persisted: false }
  }

  try {
    const userPrompt = buildUserPrompt(strategicInput)
    const rawResponse = await callClaude(SYSTEM_PROMPT, userPrompt)

    logger.info("Claude response received", { scanId, responseLength: rawResponse.length })

    const result = parseStrategicResponse(rawResponse)

    if (!result) {
      logger.error("Could not parse strategic plan, persisting fallback actions", { scanId })
      const actions = fallbackActions()
      await persistPlan(scanId, emptyPlan(), actions, "")
      return { plan: emptyPlan(), persisted: false }
    }

    logger.info("Strategic plan generated", {
      scanId,
      gaps: result.plan.competitiveGaps.length,
      opportunities: result.plan.opportunities.length,
      roadmapItems: result.plan.roadmap30Days.length,
      contentRecs: result.plan.contentRecommendations.length,
      actions: result.actions.length,
    })

    const persisted = await persistPlan(scanId, result.plan, result.actions, result.reasoning)

    return { plan: result.plan, persisted }
  } catch (err) {
    logger.error("Failed to generate strategic plan", { scanId, error: String(err) })
    return { plan: emptyPlan(), persisted: false }
  }
}

function emptyPlan(): StrategicPlan {
  return {
    executiveSummary: "",
    visibilityBreakdown: {
      overallScore: 0,
      mentionRate: 0,
      chatgptScore: null,
      claudeScore: null,
      avgPosition: null,
    },
    competitiveGaps: [],
    opportunities: [],
    roadmap30Days: [],
    contentRecommendations: [],
  }
}
