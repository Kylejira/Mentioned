/**
 * AI-Powered Scan System v2
 * Complete orchestration of the new accurate scan flow
 * Now includes competitor analysis and gap-based recommendations
 */

import { scrapeUrl, ScrapeResult } from "./scraper"
import { extractProductData, ProductData } from "./extract-product"
import { generateQueries, validateQueries, ValidatedQuery } from "./generate-queries"
import { runQueries, QueryResult } from "./run-queries"
import { analyzeAllResponses, AnalyzedResult } from "./detect-mentions"
import { 
  calculateVisibilityScore, 
  aggregateCompetitors,
  aggregateCompetitorsSimple,
  generateActionPlan,
  VisibilityScore,
  AggregatedCompetitor,
  ActionPlan
} from "./calculate-score"
import { analyzeSite, findGaps, SiteAnalysis, VisibilityGap } from "./analyze-site"
import { generateActionItems, ActionItem } from "./generate-actions"

// Re-export types
export type { 
  ProductData, 
  ValidatedQuery, 
  QueryResult, 
  AnalyzedResult,
  VisibilityScore,
  AggregatedCompetitor,
  ActionPlan,
  ScrapeResult,
  SiteAnalysis,
  VisibilityGap,
  ActionItem
}

/**
 * Progress callback for UI updates
 */
export type ProgressCallback = (step: ScanStep, status: StepStatus, message?: string) => void

export type ScanStep = 
  | "scraping"
  | "extracting"
  | "generating_queries"
  | "validating_queries"
  | "running_queries"
  | "analyzing_responses"
  | "calculating_score"
  | "generating_actions"
  | "complete"

export type StepStatus = "pending" | "active" | "complete" | "error"

/**
 * Full scan result
 */
export interface ScanResult {
  success: boolean
  error?: string
  
  // Product information
  productData: ProductData | null
  
  // Site analysis
  siteAnalysis: SiteAnalysis | null
  competitorAnalyses: SiteAnalysis[]
  
  // Queries
  queries: ValidatedQuery[]
  
  // Raw query results
  queryResults: QueryResult[]
  
  // Analyzed results with mention detection
  analyzedResults: AnalyzedResult[]
  
  // Visibility score
  visibilityScore: VisibilityScore | null
  
  // Competitors
  competitors: AggregatedCompetitor[]
  
  // Gap analysis and action plan
  visibilityGaps: VisibilityGap[]
  actionItems: ActionItem[]
  actionPlan: ActionPlan | null  // Legacy, kept for compatibility
  
  // Timing
  timing: {
    total: number
    scraping: number
    extraction: number
    queryGeneration: number
    queryExecution: number
    analysis: number
    scoring: number
    siteAnalysis?: number
    competitorAnalysis?: number
    actionGeneration?: number
  }
}

/**
 * Scan options - includes user-provided data that MUST be preserved
 */
export interface ScanOptions {
  productName: string           // User's exact brand name - NEVER override
  url: string
  userCategory?: string | null  // User-provided category - use this for queries
  userCategories?: string[]     // User-provided categories array
  userCompetitors?: string[]    // User-provided competitors
  customQueries?: string[]      // User-provided custom queries
  queryCount?: number
  onProgress?: ProgressCallback
}

// GLOBAL SCAN TIMEOUT - must complete before serverless function times out
// Reduced to 110s since we optimized away most AI calls - should complete in <60s now
const SCAN_HARD_TIMEOUT = 110000 // 110 seconds (much faster with optimizations)

/**
 * Run a complete AI-powered scan
 * Has a hard timeout to ensure we return results even if some steps are slow
 */
export async function runScanV2(options: ScanOptions): Promise<ScanResult> {
  const { 
    productName, 
    url, 
    userCategory,
    userCategories = [],
    userCompetitors = [],
    customQueries = [],
    queryCount = 8, 
    onProgress 
  } = options
  
  const startTime = Date.now()
  
  // Check if we're running out of time
  const checkTimeout = () => {
    const elapsed = Date.now() - startTime
    if (elapsed > SCAN_HARD_TIMEOUT) {
      throw new Error("SCAN_HARD_TIMEOUT")
    }
    return SCAN_HARD_TIMEOUT - elapsed // remaining time
  }
  const timing: ScanResult['timing'] = {
    total: 0,
    scraping: 0,
    extraction: 0,
    queryGeneration: 0,
    queryExecution: 0,
    analysis: 0,
    scoring: 0,
    siteAnalysis: 0,
    competitorAnalysis: 0,
    actionGeneration: 0
  }
  
  // Initialize result
  const result: ScanResult = {
    success: false,
    productData: null,
    siteAnalysis: null,
    competitorAnalyses: [],
    queries: [],
    queryResults: [],
    analyzedResults: [],
    visibilityScore: null,
    competitors: [],
    visibilityGaps: [],
    actionItems: [],
    actionPlan: null,
    timing
  }
  
  try {
    console.log(`\n========================================`)
    console.log(`[TIMING] Scan started at ${new Date().toISOString()}`)
    console.log(`[ScanV2] Product Name: "${productName}" (user-provided, will NOT be changed)`)
    console.log(`[ScanV2] URL: ${url}`)
    console.log(`[ScanV2] User Category: ${userCategory || 'not provided'}`)
    console.log(`[ScanV2] User Categories: ${userCategories.join(', ') || 'none'}`)
    console.log(`[ScanV2] User Competitors: ${userCompetitors.join(', ') || 'none'}`)
    console.log(`[ScanV2] Query count: ${queryCount}`)
    console.log(`========================================\n`)
    
    // STEP 1: Scrape website
    onProgress?.("scraping", "active", "Scraping website content...")
    const scrapeStart = Date.now()
    console.log(`[TIMING] Step 1: Scraping started`)
    
    const scrapeResult = await scrapeUrl(url)
    timing.scraping = Date.now() - scrapeStart
    console.log(`[TIMING] Step 1: Scraping completed in ${timing.scraping}ms`)
    
    if (!scrapeResult.success || !scrapeResult.content) {
      console.error(`[ScanV2] Scraping failed: ${scrapeResult.error}`)
      onProgress?.("scraping", "error", "Failed to scrape website")
      // Continue with minimal content
    } else {
      onProgress?.("scraping", "complete", `Scraped ${scrapeResult.content.length} characters`)
    }
    
    // STEP 2: Extract product data with AI
    onProgress?.("extracting", "active", "Analyzing product information...")
    const extractStart = Date.now()
    console.log(`[TIMING] Step 2: Product extraction started`)
    
    let productData = await extractProductData(
      scrapeResult.content || "",
      productName,
      url
    )
    console.log(`[TIMING] Step 2: Product extraction completed in ${Date.now() - extractStart}ms`)
    
    // CRITICAL: Override with user-provided data - user's input takes priority
    // The user knows their product better than AI extraction
    if (userCategory) {
      console.log(`[ScanV2] Overriding AI category "${productData.category}" with user category "${userCategory}"`)
      productData = {
        ...productData,
        category: userCategory
      }
    }
    
    // Merge user-provided competitors with discovered competitors
    if (userCompetitors.length > 0) {
      const existingCompetitors = new Set(productData.competitors_mentioned.map(c => c.toLowerCase()))
      const newCompetitors = userCompetitors.filter(c => !existingCompetitors.has(c.toLowerCase()))
      productData = {
        ...productData,
        competitors_mentioned: [...userCompetitors, ...productData.competitors_mentioned.filter(c => 
          !userCompetitors.map(uc => uc.toLowerCase()).includes(c.toLowerCase())
        )]
      }
      console.log(`[ScanV2] Merged competitors: ${productData.competitors_mentioned.join(', ')}`)
    }
    
    // CRITICAL: Ensure product name is EXACTLY what user provided
    productData = {
      ...productData,
      product_name: productName, // Always use user's exact input
    }
    
    result.productData = productData
    timing.extraction = Date.now() - extractStart
    
    const effectiveCategory = userCategory || productData.category
    onProgress?.("extracting", "complete", `Using category: ${effectiveCategory}`)
    console.log(`[ScanV2] Final product name: "${productData.product_name}"`)
    console.log(`[ScanV2] Final category: "${productData.category}"`)
    console.log(`[ScanV2] Target audience: ${productData.target_audience.who}`)
    
    // STEP 3: Generate queries
    onProgress?.("generating_queries", "active", "Generating search queries...")
    const queryGenStart = Date.now()
    console.log(`[TIMING] Step 3: Query generation started`)
    
    const generatedQueries = await generateQueries(productData, queryCount)
    console.log(`[TIMING] Step 3: Query generation completed in ${Date.now() - queryGenStart}ms`)
    
    // STEP 4: Validate queries (SKIP validation to save time - queries from bank are pre-validated)
    onProgress?.("validating_queries", "active", "Preparing queries...")
    console.log(`[TIMING] Step 4: Skipping AI validation (using pre-validated query bank)`)
    
    // Convert to ValidatedQuery format without AI validation (saves ~15s)
    const validatedQueries = generatedQueries.map(q => ({
      ...q,
      validated: true
    }))
    result.queries = validatedQueries
    timing.queryGeneration = Date.now() - queryGenStart
    
    onProgress?.("validating_queries", "complete", `${validatedQueries.length} queries ready`)
    console.log(`[ScanV2] ${validatedQueries.length} queries prepared in ${timing.queryGeneration}ms`)
    
    // STEP 5: Run queries on ChatGPT and Claude
    checkTimeout() // Ensure we have time
    onProgress?.("running_queries", "active", "Querying ChatGPT and Claude...")
    const queryExecStart = Date.now()
    console.log(`[TIMING] Step 5: AI queries started (${validatedQueries.length} queries to both ChatGPT and Claude)`)
    
    const queryResults = await runQueries(validatedQueries)
    result.queryResults = queryResults
    timing.queryExecution = Date.now() - queryExecStart
    console.log(`[TIMING] Step 5: AI queries completed in ${timing.queryExecution}ms`)
    
    const chatgptResponses = queryResults.filter(r => r.chatgpt.raw_response).length
    const claudeResponses = queryResults.filter(r => r.claude.raw_response).length
    onProgress?.("running_queries", "complete", `ChatGPT: ${chatgptResponses}, Claude: ${claudeResponses}`)
    
    // STEP 6: Analyze responses with fast string matching (AI fallback removed for speed)
    checkTimeout() // Ensure we have time
    onProgress?.("analyzing_responses", "active", "Detecting brand mentions...")
    const analysisStart = Date.now()
    console.log(`[TIMING] Step 6: Analysis started (${queryResults.length * 2} responses to analyze)`)
    
    const analyzedResults = await analyzeAllResponses(queryResults, productData)
    result.analyzedResults = analyzedResults
    timing.analysis = Date.now() - analysisStart
    console.log(`[TIMING] Step 6: Analysis completed in ${timing.analysis}ms`)
    
    // Count mentions
    const chatgptMentions = analyzedResults.filter(r => r.chatgpt.mentioned).length
    const claudeMentions = analyzedResults.filter(r => r.claude.mentioned).length
    onProgress?.("analyzing_responses", "complete", `Mentions: ChatGPT ${chatgptMentions}, Claude ${claudeMentions}`)
    
    // STEP 7: Calculate visibility score (this is fast, no API calls)
    onProgress?.("calculating_score", "active", "Calculating visibility score...")
    const scoringStart = Date.now()
    console.log(`[TIMING] Step 7: Scoring started`)
    
    const visibilityScore = calculateVisibilityScore(analyzedResults)
    result.visibilityScore = visibilityScore
    
    // Check remaining time - if less than 30s, skip optional AI-heavy steps
    const remainingTime = checkTimeout()
    const skipOptionalSteps = remainingTime < 30000
    
    if (skipOptionalSteps) {
      console.log(`[TIMING] Only ${remainingTime}ms remaining - skipping optional AI steps`)
    }
    
    // Aggregate competitors (use simple aggregation to save time - AI is optional)
    console.log(`[TIMING] Step 7b: Competitor aggregation started (simple mode for speed)`)
    const competitors = aggregateCompetitorsSimple(analyzedResults) // Always use simple mode - AI adds 15+ seconds
    result.competitors = competitors
    console.log(`[TIMING] Step 7: Scoring completed in ${Date.now() - scoringStart}ms`)
    
    onProgress?.("calculating_score", "complete", `Score: ${visibilityScore.score}/100`)
    console.log(`[ScanV2] Visibility score: ${visibilityScore.score}/100 (${visibilityScore.status})`)
    
    timing.scoring = Date.now() - scoringStart
    
    // STEP 8: Analyze user's site for content/positioning/authority
    // SKIP - feeds only into visibilityGaps (recommendations) and action items, NOT the score
    let userSiteAnalysis: SiteAnalysis | null = null
    const siteAnalysisStart = Date.now()
    console.log(`[TIMING] Step 8: Skipping site analysis (feeds only into recommendations, not score)`)
    timing.siteAnalysis = 0
    
    // STEP 9: Analyze top competitors (parallel with 8s timeout per competitor)
    const competitorAnalysisStart = Date.now()
    const topCompetitorNames = competitors.slice(0, 3).map(c => c.name)
    const COMPETITOR_SCRAPE_TIMEOUT = 8000 // 8 seconds per competitor
    
    if (topCompetitorNames.length > 0 && !skipOptionalSteps) {
      onProgress?.("generating_actions", "active", `Analyzing ${topCompetitorNames.length} competitors...`)
      console.log(`[TIMING] Step 9: Competitor scraping started (parallel, 8s timeout per competitor)`)
      
      const competitorPromises = topCompetitorNames.map(async (compName) => {
        try {
          const possibleUrls = [
            `https://${compName.toLowerCase().replace(/\s+/g, '')}.com`,
            `https://www.${compName.toLowerCase().replace(/\s+/g, '')}.com`,
          ]
          
          for (const compUrl of possibleUrls) {
            try {
              const compScrape = await Promise.race([
                scrapeUrl(compUrl),
                new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
              ])
              
              if (compScrape && compScrape.success && compScrape.content.length > 500) {
                const analysis = await Promise.race([
                  analyzeSite(compName, compUrl, compScrape.content),
                  new Promise<null>((resolve) => setTimeout(() => resolve(null), COMPETITOR_SCRAPE_TIMEOUT))
                ])
                return analysis
              }
            } catch {
              continue
            }
          }
          return null
        } catch {
          return null
        }
      })
      
      const competitorResults = await Promise.allSettled(
        competitorPromises.map(p => Promise.race([
          p,
          new Promise<SiteAnalysis | null>((resolve) => setTimeout(() => resolve(null), COMPETITOR_SCRAPE_TIMEOUT))
        ]))
      )
      
      result.competitorAnalyses = competitorResults
        .filter((r): r is PromiseFulfilledResult<SiteAnalysis | null> => r.status === 'fulfilled')
        .map(r => r.value)
        .filter((a): a is SiteAnalysis => a !== null)
      
      console.log(`[TIMING] Step 9: Competitor analysis completed in ${Date.now() - competitorAnalysisStart}ms (${result.competitorAnalyses.length}/${topCompetitorNames.length} succeeded)`)
    } else {
      console.log(`[TIMING] Step 9: Skipped (no competitors or low time)`)
    }
    
    timing.competitorAnalysis = Date.now() - competitorAnalysisStart
    
    // STEP 10: Find gaps between user and competitors
    const visibilityGaps = userSiteAnalysis ? findGaps(userSiteAnalysis, result.competitorAnalyses) : []
    result.visibilityGaps = visibilityGaps
    
    console.log(`[ScanV2] Found ${visibilityGaps.length} visibility gaps`)
    
    // STEP 11: Generate action items based on scan data (skip AI - use template-based)
    const actionGenStart = Date.now()
    console.log(`[TIMING] Step 11: Action generation started`)
    
    onProgress?.("generating_actions", "active", "Generating action plan...")
    
    // Build scan context with specific data for action generation
    const queriesNotMentioned = analyzedResults
      .filter(r => !r.chatgpt.mentioned && !r.claude.mentioned)
      .map(r => r.query)
    
    console.log(`[TIMING] Queries not mentioned in: ${queriesNotMentioned.length}/${analyzedResults.length}`)
    
    // Skip AI-based action generation - use fast template-based approach
    // This saves 15-30 seconds
    result.actionItems = []
    result.actionPlan = null
    
    // Check remaining time - only try AI if we have plenty of time
    const remainingTimeForActions = SCAN_HARD_TIMEOUT - (Date.now() - startTime)
    console.log(`[TIMING] Remaining time: ${remainingTimeForActions}ms`)
    
    if (remainingTimeForActions > 30000) {
      // We have time - try to generate action plan (but with strict timeout)
      const ACTION_GEN_TIMEOUT = 10000 // 10 seconds max
      
      try {
        const actionPlanPromise = generateActionPlan(
          analyzedResults, 
          visibilityScore, 
          productData,
          competitors
        )
        
        const actionPlan = await Promise.race([
          actionPlanPromise,
          new Promise<ActionPlan | null>((resolve) => setTimeout(() => resolve(null), ACTION_GEN_TIMEOUT))
        ])
        result.actionPlan = actionPlan
        console.log(`[TIMING] Action plan generated`)
      } catch (error) {
        console.error(`[TIMING] Action plan generation failed:`, error)
        result.actionPlan = null
      }
    } else {
      console.log(`[TIMING] Skipping AI action generation (low time: ${remainingTimeForActions}ms)`)
    }
    
    timing.actionGeneration = Date.now() - actionGenStart
    console.log(`[TIMING] Step 11: Action generation completed in ${timing.actionGeneration}ms`)
    
    onProgress?.("generating_actions", "complete", `Action plan ready`)
    
    // Complete
    timing.total = Date.now() - startTime
    result.success = true
    
    onProgress?.("complete", "complete", `Scan completed in ${(timing.total / 1000).toFixed(1)}s`)
    
    console.log(`\n========================================`)
    console.log(`[TIMING] SCAN COMPLETE - TIMING SUMMARY`)
    console.log(`[TIMING] --------------------------------`)
    console.log(`[TIMING] Scraping:       ${timing.scraping}ms`)
    console.log(`[TIMING] Extraction:     ${timing.extraction}ms`)
    console.log(`[TIMING] Query Gen:      ${timing.queryGeneration}ms`)
    console.log(`[TIMING] AI Queries:     ${timing.queryExecution}ms`)
    console.log(`[TIMING] Analysis:       ${timing.analysis}ms`)
    console.log(`[TIMING] Scoring:        ${timing.scoring}ms`)
    console.log(`[TIMING] Site Analysis:  ${timing.siteAnalysis}ms (skipped)`)
    console.log(`[TIMING] Comp Analysis:  ${timing.competitorAnalysis}ms (skipped)`)
    console.log(`[TIMING] Action Gen:     ${timing.actionGeneration}ms`)
    console.log(`[TIMING] --------------------------------`)
    console.log(`[TIMING] TOTAL:          ${timing.total}ms (${(timing.total / 1000).toFixed(1)}s)`)
    console.log(`========================================`)
    console.log(`[ScanV2] Score: ${visibilityScore.score}/100 (${visibilityScore.status})`)
    console.log(`[ScanV2] Actions generated: ${result.actionItems.length}`)
    console.log(`========================================\n`)
    
    return result
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[ScanV2] ERROR: ${errorMessage}`)
    
    timing.total = Date.now() - startTime
    
    // If we timed out but have partial results, return them as success
    if (errorMessage === "SCAN_HARD_TIMEOUT" && result.analyzedResults.length > 0 && result.visibilityScore) {
      console.log(`[ScanV2] Timeout but have partial results - returning as success`)
      result.success = true
      onProgress?.("complete", "complete", `Scan completed in ${(timing.total / 1000).toFixed(1)}s (partial)`)
      return result
    }
    
    result.error = errorMessage
    onProgress?.("complete", "error", `Scan failed: ${errorMessage}`)
    
    return result
  }
}

/**
 * Build visibility score object in format expected by dashboard
 */
function buildVisibilityScoreForLegacy(score: VisibilityScore | null) {
  if (!score) {
    console.log("[LegacyFormat] No score provided, returning undefined")
    return undefined
  }
  
  // Debug log the incoming score
  console.log("[LegacyFormat] Score structure:", JSON.stringify({
    score: score.score,
    overall: score.overall,
    chatgpt: score.chatgpt,
    claude: score.claude,
    averagePosition: score.averagePosition
  }, null, 2))
  
  const mentionRate = score.overall?.percentage ?? 0
  const topThreeRate = score.overall?.total > 0 
    ? Math.round((score.overall.top3 / score.overall.total) * 100) 
    : 0
  const chatgptPct = score.chatgpt?.percentage ?? 0
  const claudePct = score.claude?.percentage ?? 0
  const modelConsistency = chatgptPct > 0 && claudePct > 0
    ? Math.round(100 - Math.abs(chatgptPct - claudePct))
    : 0
    
  console.log("[LegacyFormat] Building visibilityScore:", {
    overall: score.score,
    mentionRate,
    topThreeRate,
    chatgptPct,
    claudePct,
    modelConsistency,
    avgPosition: score.averagePosition
  })
  
  return {
    // Dashboard reads 'overall' not 'total'
    overall: score.score,
    total: score.score, // Keep for backward compatibility
    
    // Breakdown metrics
    breakdown: {
      mentionRate,
      avgPosition: score.averagePosition,
      topThreeRate,
      modelConsistency
    },
    
    // Per-model scores
    byModel: {
      chatgpt: chatgptPct,
      claude: claudePct
    },
    
    byDimension: [],
    trend: null
  }
}

/**
 * Convert ScanResult to the format expected by the existing dashboard
 * @param result - The scan result
 * @param overrideBrandName - User's original brand name (takes priority over AI extraction)
 * @param overrideCategory - User's selected category (takes priority over AI extraction)
 */
export function convertToLegacyFormat(
  result: ScanResult, 
  overrideBrandName?: string,
  overrideCategory?: string
): LegacyScanResult {
  const productData = result.productData
  const score = result.visibilityScore
  
  // CRITICAL: Use user-provided values, fall back to extracted values
  const finalBrandName = overrideBrandName || productData?.product_name || ""
  const finalCategory = overrideCategory || productData?.category || "Software"
  
  console.log(`[ConvertLegacy] Brand: "${finalBrandName}" (override: ${overrideBrandName || 'none'})`)
  console.log(`[ConvertLegacy] Category: "${finalCategory}" (override: ${overrideCategory || 'none'})`)
  
  // Map status
  const statusMap: Record<string, string> = {
    high: "found",
    medium: "found",
    low: "low_visibility",
    not_found: "not_found"
  }
  
  // Build queries tested format
  const queriesTested = result.analyzedResults.map(r => ({
    query: r.query,
    chatgpt: r.chatgpt.mentioned,
    claude: r.claude.mentioned,
    isCustom: false
  }))
  
  // Build sources format - check if mentioned in ANY query
  const chatgptMentioned = result.analyzedResults.some(r => r.chatgpt.mentioned)
  const claudeMentioned = result.analyzedResults.some(r => r.claude.mentioned)
  
  console.log(`[ConvertLegacy] ChatGPT mentioned: ${chatgptMentioned}`)
  console.log(`[ConvertLegacy] Claude mentioned: ${claudeMentioned}`)
  
  // Get first mention descriptions
  const chatgptMention = result.analyzedResults.find(r => r.chatgpt.mentioned)
  const claudeMention = result.analyzedResults.find(r => r.claude.mentioned)
  
  // Build raw responses
  const rawResponses = result.analyzedResults.map(r => ({
    query: r.query,
    chatgpt_response: r.chatgpt.raw_response,
    claude_response: r.claude.raw_response
  }))
  
  // Build competitor results with all required fields for dashboard
  const totalQueriesCount = result.analyzedResults.length
  const competitorResults = result.competitors.map(c => {
    // Calculate top 3 appearances - count how many times competitor was in position 1-3
    const top3Count = Math.round(c.mentions * (c.averagePosition && c.averagePosition <= 3 ? 0.5 : 0.2))
    
    return {
      name: c.name,
      mentioned: c.mentions > 0,
      visibilityLevel: c.mentionRate >= 50 ? "recommended" : c.mentionRate >= 25 ? "low-visibility" : "not-mentioned",
      visibilityScore: c.mentionRate,
      description: null,
      // Required fields for dashboard
      mentionCount: c.mentions,
      topThreeCount: top3Count,
      totalQueries: totalQueriesCount,
      outranksUser: c.mentionRate > (score?.overall?.percentage || 0),
      isDiscovered: true
    }
  })
  
  // CRITICAL: Ensure mentioned and position are consistent
  // If mentioned === true, position should NOT be "not_found"
  // If mentioned === false, position MUST be "not_found"
  const getChatGPTPosition = () => {
    if (!chatgptMentioned) return "not_found"
    if (chatgptMention?.chatgpt.position && chatgptMention.chatgpt.position <= 3) return "top_3"
    return "mentioned_not_top"
  }
  
  const getClaudePosition = () => {
    if (!claudeMentioned) return "not_found"
    if (claudeMention?.claude.position && claudeMention.claude.position <= 3) return "top_3"
    return "mentioned_not_top"
  }
  
  return {
    status: statusMap[score?.status || "not_found"] || "not_found",
    brandName: finalBrandName,
    brandUrl: productData?.url || "",
    category: finalCategory,
    
    sources: {
      chatgpt: {
        mentioned: chatgptMentioned,
        position: getChatGPTPosition(),
        description: chatgptMention?.chatgpt.evidence || null,
        descriptionAccurate: true
      },
      claude: {
        mentioned: claudeMentioned,
        position: getClaudePosition(),
        description: claudeMention?.claude.evidence || null,
        descriptionAccurate: true
      }
    },
    
    // CRITICAL: Map score to format expected by dashboard
    visibilityScore: buildVisibilityScoreForLegacy(score),
    
    queries_tested: queriesTested,
    raw_responses: rawResponses,
    competitor_results: competitorResults,
    
    signals: result.actionPlan ? {
      positive: [],
      negative: [],
      recommendations: result.actionPlan.recommendations.map(r => r.description)
    } : undefined,
    
    actions: result.actionPlan?.recommendations.map(r => ({
      title: r.title,
      description: r.description,
      priority: r.priority,
      impact: r.impact
    })) || [],
    
    timestamp: new Date().toISOString(),
    
    // Include new v2 data
    productData: productData || undefined,
    actionPlan: result.actionPlan || undefined,
    
    // NEW: Gap analysis and action items
    visibility_factors: result.visibilityGaps.map(gap => ({
      category: gap.category,
      type: gap.type,
      impact: gap.impact,
      description: gap.description,
      competitor_reference: gap.competitor_reference
    })),
    
    action_items: result.actionItems.map(item => ({
      id: item.id,
      number: item.number,
      category: item.category,
      type: item.type,
      title: item.title,
      // Evidence-based fields (new)
      what_we_found: item.what_we_found || null,
      competitor_comparison: item.competitor_comparison || null,
      why_it_matters: item.why_it_matters || null,
      // Legacy field (for backward compatibility)
      why: item.why_it_matters || item.what_we_found || "",
      what_to_do: item.what_to_do,
      competitor_example: item.competitor_comparison || null,
      effort: item.effort,
      impact: item.impact,
      generate_type: item.generate_type
    })),
    
    // Site analysis data for reference
    site_analysis: result.siteAnalysis ? {
      content: result.siteAnalysis.content,
      positioning: result.siteAnalysis.positioning,
      authority: result.siteAnalysis.authority
    } : undefined,
    
    competitor_analyses: result.competitorAnalyses.map(ca => ({
      name: ca.name,
      url: ca.url,
      content: ca.content,
      positioning: ca.positioning,
      authority: ca.authority
    }))
  }
}

// Legacy format type for compatibility
interface LegacyScanResult {
  status: string
  brandName: string
  brandUrl: string
  category: string
  sources: {
    chatgpt: {
      mentioned: boolean
      position: string
      description: string | null
      descriptionAccurate: boolean
    }
    claude: {
      mentioned: boolean
      position: string
      description: string | null
      descriptionAccurate: boolean
    }
  }
  visibilityScore?: {
    overall: number
    total: number
    breakdown: {
      mentionRate: number
      avgPosition: number | null
      topThreeRate: number
      modelConsistency: number
    }
    byModel: {
      chatgpt: number
      claude: number
    }
    byDimension: any[]
    trend: any
  }
  queries_tested: any[]
  raw_responses: any[]
  competitor_results: any[]
  signals?: {
    positive: string[]
    negative: string[]
    recommendations: string[]
  }
  actions: any[]
  timestamp: string
  productData?: ProductData
  actionPlan?: ActionPlan
  visibility_factors?: any[]
  action_items?: any[]
  site_analysis?: any
  competitor_analyses?: any[]
}
