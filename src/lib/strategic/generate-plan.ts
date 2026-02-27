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

Always respond with valid JSON matching the exact schema requested. No markdown, no code fences, just raw JSON.`

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
  ]
}

Be specific to this brand, its industry, and the actual scan data. Reference real competitor names, actual query gaps, and concrete content ideas. Do not be generic.`
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

function parseStrategicResponse(raw: string): StrategicPlan | null {
  try {
    let cleaned = raw.trim()
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenceMatch) cleaned = fenceMatch[1].trim()

    const parsed = JSON.parse(cleaned)

    return {
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

// ── Persistence ──

async function persistPlan(scanId: string, plan: StrategicPlan): Promise<boolean> {
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
        updated_at: new Date().toISOString(),
      },
      { onConflict: "scan_id" }
    )

    if (error) {
      logger.error("Failed to persist action plan", { scanId, error: error.message })
      return false
    }

    logger.info("Action plan persisted", { scanId })
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

    const plan = parseStrategicResponse(rawResponse)

    if (!plan) {
      logger.error("Could not parse strategic plan, returning empty plan", { scanId })
      return { plan: emptyPlan(), persisted: false }
    }

    logger.info("Strategic plan generated", {
      scanId,
      gaps: plan.competitiveGaps.length,
      opportunities: plan.opportunities.length,
      roadmapItems: plan.roadmap30Days.length,
      contentRecs: plan.contentRecommendations.length,
    })

    const persisted = await persistPlan(scanId, plan)

    return { plan, persisted }
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
