import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase-admin"
import { saveScanHistory } from "@/lib/scan-history"
import { ScanOrchestrator, type ScanResult as V3ScanResult, type ScanInput } from "@/lib/scan-v3"
import type { PlanTier, ScanLimits } from "@/lib/scan-v3"
import { OpenAIProvider, ClaudeProvider, GeminiProvider } from "@/lib/providers"
import type { AIProvider } from "@/lib/providers"
import type { LlmProviderName } from "@/lib/scan-v3"
import { scrapeUrl } from "@/lib/scraper"
import { getAllowedProviders, getMaxQueries, getConcurrencyLimit } from "@/lib/plans/enforce"
import { log } from "@/lib/logger"

const logger = log.create("scan-runner")

export interface ScanConfig {
  scanId: string
  userId: string | null
  brandName: string
  brandUrl: string
  category?: string
  planTier: PlanTier
  input: ScanInput
  effectivePlan?: string
}

function createProgressUpdater(db: SupabaseClient, scanId: string) {
  return async (progress: number, stage: string) => {
    const status = stage === "complete" ? "complete" : "processing"
    await db
      .from("scans")
      .update({ progress, stage, status })
      .eq("id", scanId)
    logger.debug("Progress updated", { scanId, progress, stage })
  }
}

export interface ScanRunResult {
  success: true
  score: number
  legacyResult: Record<string, unknown>
  v3Result: V3ScanResult
}

const profilingProvider = new OpenAIProvider({ model: "gpt-4o-mini", maxTokens: 2000, temperature: 0 })

function createLlmCallAdapter(): (prompt: string) => Promise<string> {
  return (prompt: string) => profilingProvider.generateResponse(prompt)
}

function getActiveProviders(): { adapter: (query: string, provider: LlmProviderName) => Promise<string>; names: LlmProviderName[] } {
  const providers: Record<string, AIProvider> = {
    openai: new OpenAIProvider({ model: "gpt-4o", maxTokens: 1500, temperature: 0.3 }),
    claude: new ClaudeProvider({ model: "claude-3-haiku-20240307", maxTokens: 1500, temperature: 0.3 }),
  }

  const names: LlmProviderName[] = ["openai", "claude"]

  if (process.env.GEMINI_API_KEY) {
    providers.gemini = new GeminiProvider({ model: "gemini-2.5-flash", maxTokens: 1500, temperature: 0.3 })
    names.push("gemini")
    logger.info("Gemini provider enabled")
  }

  const adapter = (query: string, provider: LlmProviderName) => {
    const p = providers[provider]
    if (!p) throw new Error(`Unknown provider: ${provider}`)
    return p.generateResponse(query)
  }

  return { adapter, names }
}

function createScrapeAdapter(): (url: string) => Promise<string> {
  return async (url: string) => {
    const result = await scrapeUrl(url)
    return result.content || ""
  }
}

/**
 * Runs a full V3 scan, saves results to DB and scan_history.
 * This is the core scan logic extracted from the API route so it can
 * be called from both the synchronous API handler and the BullMQ worker.
 */
export async function runScan(config: ScanConfig): Promise<ScanRunResult> {
  const { scanId, userId, brandName, brandUrl, category, planTier, input } = config

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured")
  }

  // Resolve effective plan for enforcement (defaults to 'free' on any error)
  let userPlan = config.effectivePlan || "free"
  if (!config.effectivePlan && userId) {
    try {
      const lookupDb = createAdminClient()
      const { data: sub } = await lookupDb
        .from("subscriptions")
        .select("plan")
        .eq("user_id", userId)
        .eq("status", "active")
        .single()
      userPlan = sub?.plan || "free"
    } catch {
      userPlan = "free"
    }
  }

  logger.info("Scan executing with plan:", { userPlan, planTier })

  const { adapter: queryAdapter, names: availableProviders } = getActiveProviders()

  // ENFORCEMENT 1: Provider gating — filter providers by plan allowlist
  let activeProviders: LlmProviderName[]
  try {
    const allowed = getAllowedProviders(userPlan)
    activeProviders = availableProviders.filter(p => allowed.includes(p))
    if (activeProviders.length === 0) activeProviders = availableProviders.slice(0, 2)
    logger.info("Provider enforcement applied", { userPlan, allowed, active: activeProviders })
  } catch {
    activeProviders = availableProviders
  }

  logger.info("Starting scan", { scanId, brand: brandName, url: brandUrl, plan: planTier, effectivePlan: userPlan, providers: activeProviders })

  const adminDb = createAdminClient()
  const onProgress = createProgressUpdater(adminDb, scanId)

  // ENFORCEMENT 2: Cap queries and concurrency by plan
  let limitsOverride: Partial<ScanLimits> | undefined
  try {
    const planMaxQueries = getMaxQueries(userPlan)
    const planConcurrency = getConcurrencyLimit(userPlan)
    limitsOverride = {
      maxQueries: planMaxQueries,
      maxConcurrentLlmCalls: planConcurrency,
    }
    logger.info("Query/concurrency enforcement applied", {
      userPlan,
      planMaxQueries,
      planConcurrency,
    })
  } catch {
    // Fall through with original planTier limits
  }

  const orchestrator = new ScanOrchestrator(
    adminDb,
    createLlmCallAdapter(),
    queryAdapter,
    createScrapeAdapter(),
    planTier,
    activeProviders,
    limitsOverride
  )

  const v3Result = await orchestrator.runScan(scanId, brandUrl, input, onProgress)

  logger.info("Scan complete", { scanId, brand: brandName, score: v3Result.score.final_score })

  const legacyResult = convertV3ToLegacy(v3Result, brandName, category)

  if (userId) {
    try {
      await saveScanHistory(userId, {
        productUrl: brandUrl,
        productName: brandName,
        category: category || v3Result.profile.category,
        score: v3Result.score.final_score,
        mentionRate: v3Result.score.mention_rate * 100,
        top3Rate: 0,
        avgPosition: null,
        chatgptScore: null,
        claudeScore: null,
        chatgptMentioned: null,
        claudeMentioned: null,
        fullResult: {
          ...legacyResult,
          brandName,
          brandUrl,
          timestamp: new Date().toISOString(),
        },
      })
      logger.info("Scan history saved", { scanId, userId, brand: brandName })
    } catch (historyErr) {
      logger.error("Failed to save scan history", { scanId, error: String(historyErr) })
    }
  }

  return {
    success: true,
    score: v3Result.score.final_score,
    legacyResult,
    v3Result,
  }
}

/**
 * Map V3 ScanResult to the legacy frontend format.
 */
export function convertV3ToLegacy(v3: V3ScanResult, brandName: string, category?: string) {
  const mentionRate = Math.round(v3.score.mention_rate * 100)
  const score = v3.score.final_score
  const analyses = v3.analyses || []

  interface QueryMapEntry {
    chatgpt: boolean; claude: boolean; gemini: boolean
    chatgpt_response?: string; claude_response?: string; gemini_response?: string
  }
  const queryMap = new Map<string, QueryMapEntry>()
  for (const a of analyses) {
    const key = a.query.text
    if (!queryMap.has(key)) {
      queryMap.set(key, { chatgpt: false, claude: false, gemini: false })
    }
    const entry = queryMap.get(key)!
    if (a.provider === "openai") {
      entry.chatgpt = a.brand_detection.detected
      entry.chatgpt_response = a.raw_response
    } else if (a.provider === "claude") {
      entry.claude = a.brand_detection.detected
      entry.claude_response = a.raw_response
    } else if (a.provider === "gemini") {
      entry.gemini = a.brand_detection.detected
      entry.gemini_response = a.raw_response
    }
  }

  const queriesTested = Array.from(queryMap.entries()).map(([query, result]) => ({
    query,
    chatgpt: result.chatgpt,
    claude: result.claude,
    gemini: result.gemini,
  }))

  const rawResponses = Array.from(queryMap.entries()).map(([query, result]) => ({
    query,
    chatgpt_response: result.chatgpt_response || null,
    claude_response: result.claude_response || null,
    gemini_response: result.gemini_response || null,
  }))

  const openaiAnalyses = analyses.filter(a => a.provider === "openai")
  const claudeAnalyses = analyses.filter(a => a.provider === "claude")
  const geminiAnalyses = analyses.filter(a => a.provider === "gemini")
  const chatgptMentioned = openaiAnalyses.some(a => a.brand_detection.detected)
  const claudeMentioned = claudeAnalyses.some(a => a.brand_detection.detected)
  const geminiMentioned = geminiAnalyses.some(a => a.brand_detection.detected)
  const chatgptMentionCount = openaiAnalyses.filter(a => a.brand_detection.detected).length
  const claudeMentionCount = claudeAnalyses.filter(a => a.brand_detection.detected).length
  const geminiMentionCount = geminiAnalyses.filter(a => a.brand_detection.detected).length
  const chatgptMentionRate = openaiAnalyses.length > 0 ? Math.round((chatgptMentionCount / openaiAnalyses.length) * 100) : 0
  const claudeMentionRate = claudeAnalyses.length > 0 ? Math.round((claudeMentionCount / claudeAnalyses.length) * 100) : 0
  const geminiMentionRate = geminiAnalyses.length > 0 ? Math.round((geminiMentionCount / geminiAnalyses.length) * 100) : 0

  return {
    status: "complete",
    brandName,
    category: category || v3.profile.category,
    visibilityScore: {
      total: score,
      overall: score,
      breakdown: {
        mentionRate,
        topThreeRate: 0,
        avgPosition: null,
        modelConsistency: chatgptMentioned === claudeMentioned ? 100 : 50,
      },
      byModel: {
        chatgpt: chatgptMentionRate,
        claude: claudeMentionRate,
        ...(geminiAnalyses.length > 0 ? { gemini: geminiMentionRate } : {}),
      },
    },
    productData: {
      name: v3.profile.brand_name,
      category: v3.profile.category,
      competitors: v3.profile.competitors_mentioned,
      description: v3.profile.tagline,
    },
    sources: {
      chatgpt: {
        mentioned: chatgptMentioned,
        position: chatgptMentionCount >= 3 ? "top_3" : chatgptMentioned ? "mentioned" : "not_found",
        description: chatgptMentioned ? `Mentioned in ${chatgptMentionCount} of ${openaiAnalyses.length} queries` : null,
        descriptionAccurate: true,
      },
      claude: {
        mentioned: claudeMentioned,
        position: claudeMentionCount >= 3 ? "top_3" : claudeMentioned ? "mentioned" : "not_found",
        description: claudeMentioned ? `Mentioned in ${claudeMentionCount} of ${claudeAnalyses.length} queries` : null,
        descriptionAccurate: true,
      },
      ...(geminiAnalyses.length > 0 ? {
        gemini: {
          mentioned: geminiMentioned,
          position: geminiMentionCount >= 3 ? "top_3" : geminiMentioned ? "mentioned" : "not_found",
          description: geminiMentioned ? `Mentioned in ${geminiMentionCount} of ${geminiAnalyses.length} queries` : null,
          descriptionAccurate: true,
        },
      } : {}),
    },
    queries_tested: queriesTested,
    query_count: v3.query_count,
    signals: [],
    actions: [],
    competitor_results: v3.competitors.map((c) => ({
      name: c.competitor_name,
      mentioned: c.last_mention_count > 0,
      mentionCount: c.last_mention_count,
      topThreeCount: 0,
      totalQueries: v3.query_count,
      visibilityLevel: c.last_mention_count > 3 ? "recommended" : c.last_mention_count > 0 ? "low_visibility" : "not_mentioned",
      outranksUser: c.last_mention_count > Math.round(v3.score.mention_rate * v3.query_count),
    })),
    raw_responses: rawResponses,
    scan_version: "v3",
  }
}
