import type {
  ScanInput,
  ScanResult,
  SourceResult,
  MentionAnalysis,
  VisibilityStatus,
  VisibilityScore,
  QueryDimension,
  DimensionScore,
  CompetitorResult,
  RawQueryResponse,
  EnhancedScanInput,
  Signal,
} from "./types"
import { generateQueries, generateTaggedQueries, inferCategory, type TaggedQuery } from "./generate-queries"
import { queryChatGPT, isOpenAIConfigured } from "./query-chatgpt"
import { queryClaude, isAnthropicConfigured } from "./query-claude"
import { analyzeResponse, checkDescriptionAccuracy } from "./analyze-response"
import { detectSignals } from "./detect-signals"
import { generateActions } from "./generate-actions"
import { analyzeURL } from "./analyze-url"

export interface ScanProgress {
  step: string
  completed: string[]
  current: string
  pending: string[]
}

export type ProgressCallback = (progress: ScanProgress) => void

/**
 * Run a complete visibility scan for a brand
 * For paid plans with enhanced scanning, runs 3 parallel scans and averages results
 * for more consistent and reliable visibility scores
 */
export async function runScan(
  input: ScanInput,
  onProgress?: ProgressCallback
): Promise<ScanResult> {
  const queryCount = input.queryCount || 12
  const isEnhancedScan = queryCount > 15 // Paid plans get multi-scan averaging
  
  if (isEnhancedScan) {
    // Run 3 scans in parallel for paid plans (better accuracy through averaging)
    console.log("Running enhanced multi-scan (3x parallel) for paid plan...")
    
    // Progress for multi-scan
    if (onProgress) {
      onProgress({
        step: "Running enhanced multi-scan analysis",
        completed: [],
        current: "Running 3 parallel scans for accuracy",
        pending: ["Averaging results"],
      })
    }
    
    // Run 3 scans in parallel - total time ≈ time for 1 scan
    const scanPromises = [
      runSingleScan(input),
      runSingleScan(input),
      runSingleScan(input),
    ]
    
    const results = await Promise.all(scanPromises)
    
    if (onProgress) {
      onProgress({
        step: "Averaging results",
        completed: ["Running 3 parallel scans for accuracy"],
        current: "Averaging results",
        pending: [],
      })
    }
    
    // Average the results for more consistent scores
    return averageScanResults(results)
  }
  
  // Free tier: run single scan
  return runSingleScan(input, onProgress)
}

/**
 * Average multiple scan results for more consistent visibility scores
 */
function averageScanResults(results: ScanResult[]): ScanResult {
  if (results.length === 0) throw new Error("No scan results to average")
  if (results.length === 1) return results[0]
  
  const base = results[0]
  const count = results.length
  
  // Average visibility score
  const avgOverall = Math.round(
    results.reduce((sum, r) => sum + r.visibilityScore.overall, 0) / count
  )
  
  // Average dimension scores
  const dimensionMap = new Map<string, { totalScore: number; count: number }>()
  for (const result of results) {
    for (const dim of result.visibilityScore.byDimension) {
      const existing = dimensionMap.get(dim.dimension) || { totalScore: 0, count: 0 }
      dimensionMap.set(dim.dimension, {
        totalScore: existing.totalScore + dim.score,
        count: existing.count + 1,
      })
    }
  }
  
  const avgByDimension = Array.from(dimensionMap.entries()).map(([dimension, data]) => {
    const baseDim = base.visibilityScore.byDimension.find(d => d.dimension === dimension)
    return {
      dimension: dimension as QueryDimension,
      label: baseDim?.label || dimension,
      score: Math.round(data.totalScore / data.count),
      queriesCount: baseDim?.queriesCount || 0,
      mentionCount: baseDim?.mentionCount || 0,
    }
  })
  
  // Average source mention counts
  const avgChatGPTMentionCount = Math.round(
    results.reduce((sum, r) => sum + r.sources.chatgpt.mentionCount, 0) / count
  )
  const avgClaudeMentionCount = Math.round(
    results.reduce((sum, r) => sum + r.sources.claude.mentionCount, 0) / count
  )
  const avgChatGPTTopThree = Math.round(
    results.reduce((sum, r) => sum + r.sources.chatgpt.topThreeCount, 0) / count
  )
  const avgClaudeTopThree = Math.round(
    results.reduce((sum, r) => sum + r.sources.claude.topThreeCount, 0) / count
  )
  
  // Determine status by majority vote
  const statusCounts = new Map<VisibilityStatus, number>()
  for (const result of results) {
    statusCounts.set(result.status, (statusCounts.get(result.status) || 0) + 1)
  }
  let majorityStatus = base.status
  let maxStatusCount = 0
  for (const [status, statusCount] of statusCounts) {
    if (statusCount > maxStatusCount) {
      majorityStatus = status
      maxStatusCount = statusCount
    }
  }
  
  // Average competitor results
  const competitorMap = new Map<string, { mentionCount: number; topThree: number; count: number }>()
  for (const result of results) {
    for (const comp of result.competitor_results) {
      const existing = competitorMap.get(comp.name) || { mentionCount: 0, topThree: 0, count: 0 }
      competitorMap.set(comp.name, {
        mentionCount: existing.mentionCount + comp.mentionCount,
        topThree: existing.topThree + comp.topThreeCount,
        count: existing.count + 1,
      })
    }
  }
  
  const avgCompetitorResults: CompetitorResult[] = Array.from(competitorMap.entries()).map(([name, data]) => {
    const baseComp = base.competitor_results.find(c => c.name === name)
    const avgMentions = Math.round(data.mentionCount / data.count)
    const avgTopThree = Math.round(data.topThree / data.count)
    return {
      name,
      mentioned: avgMentions > 0,
      mentionCount: avgMentions,
      topThreeCount: avgTopThree,
      totalQueries: baseComp?.totalQueries || 0,
      visibilityLevel: baseComp?.visibilityLevel || "not_mentioned",
      description: baseComp?.description || null,
      outranksUser: baseComp?.outranksUser || false,
      isDiscovered: baseComp?.isDiscovered || false,
    }
  })
  
  // Average query results - use majority vote for mentioned status
  const avgQueriesTested = base.queries_tested.map((baseQuery, idx) => {
    const chatgptMentioned = results.filter(r => r.queries_tested[idx]?.chatgpt).length
    const claudeMentioned = results.filter(r => r.queries_tested[idx]?.claude).length
    
    // Average positions (only from results where mentioned)
    const chatgptPositions = results
      .map(r => r.queries_tested[idx]?.chatgptPosition)
      .filter((p): p is number => p !== null && p !== undefined)
    const claudePositions = results
      .map(r => r.queries_tested[idx]?.claudePosition)
      .filter((p): p is number => p !== null && p !== undefined)
    
    const avgChatgptPos = chatgptPositions.length > 0
      ? Math.round(chatgptPositions.reduce((a, b) => a + b, 0) / chatgptPositions.length)
      : null
    const avgClaudePos = claudePositions.length > 0
      ? Math.round(claudePositions.reduce((a, b) => a + b, 0) / claudePositions.length)
      : null
    
    return {
      query: baseQuery.query,
      chatgpt: chatgptMentioned >= count / 2, // Majority vote
      claude: claudeMentioned >= count / 2,   // Majority vote
      chatgptPosition: avgChatgptPos,
      claudePosition: avgClaudePos,
      dimension: baseQuery.dimension,
      isCustom: baseQuery.isCustom,
    }
  })
  
  // Average breakdown metrics
  const avgBreakdown = {
    mentionRate: Math.round(
      results.reduce((sum, r) => sum + r.visibilityScore.breakdown.mentionRate, 0) / count
    ),
    avgPosition: (() => {
      const positions = results
        .map(r => r.visibilityScore.breakdown.avgPosition)
        .filter((p): p is number => p !== null)
      return positions.length > 0 
        ? Math.round(positions.reduce((a, b) => a + b, 0) / positions.length)
        : null
    })(),
    topThreeRate: Math.round(
      results.reduce((sum, r) => sum + r.visibilityScore.breakdown.topThreeRate, 0) / count
    ),
    modelConsistency: Math.round(
      results.reduce((sum, r) => sum + r.visibilityScore.breakdown.modelConsistency, 0) / count
    ),
  }
  
  // Average by-model scores
  const avgByModel = {
    chatgpt: Math.round(
      results.reduce((sum, r) => sum + r.visibilityScore.byModel.chatgpt, 0) / count
    ),
    claude: Math.round(
      results.reduce((sum, r) => sum + r.visibilityScore.byModel.claude, 0) / count
    ),
  }
  
  return {
    ...base,
    status: majorityStatus,
    visibilityScore: {
      overall: avgOverall,
      breakdown: avgBreakdown,
      byModel: avgByModel,
      byDimension: avgByDimension,
    },
    sources: {
      chatgpt: {
        ...base.sources.chatgpt,
        mentionCount: avgChatGPTMentionCount,
        topThreeCount: avgChatGPTTopThree,
      },
      claude: {
        ...base.sources.claude,
        mentionCount: avgClaudeMentionCount,
        topThreeCount: avgClaudeTopThree,
      },
    },
    queries_tested: avgQueriesTested,
    competitor_results: avgCompetitorResults,
    // Keep raw_responses from first scan (for debugging)
    // Signals and actions from base result (they should be similar)
  }
}

/**
 * Run a single visibility scan (internal implementation)
 */
async function runSingleScan(
  input: ScanInput,
  onProgress?: ProgressCallback
): Promise<ScanResult> {
  const steps = [
    "Analyzing website",
    "Generating queries",
    "Querying ChatGPT",
    "Querying Claude",
    "Analyzing results",
    "Detecting signals",
    "Generating recommendations",
  ]

  let currentStep = 0
  const reportProgress = () => {
    if (onProgress) {
      onProgress({
        step: steps[currentStep],
        completed: steps.slice(0, currentStep),
        current: steps[currentStep],
        pending: steps.slice(currentStep + 1),
      })
    }
  }

  // Step 1: Analyze the website URL to extract keywords, features, and discover competitors
  reportProgress()
  let enhancedInput: EnhancedScanInput = {
    ...input,
    extractedKeywords: [],
    extractedFeatures: [],
    extractedCategory: null,
    extractedDescription: null,
    targetAudience: null,
    useCases: [],
    allCompetitors: [...input.competitors],
    urlAnalyzed: false,
    detectedCountry: null,
    detectedCountryCode: null,
    isLocationBound: false,
    industryType: null,
    productType: null,
    industryTerminology: null,
  }

  let urlAnalysisResult = null
  
  if (input.brandUrl) {
    try {
      urlAnalysisResult = await analyzeURL(input.brandUrl)
      
      if (urlAnalysisResult && urlAnalysisResult.confidence > 0.3) {
        enhancedInput = {
          ...enhancedInput,
          extractedKeywords: urlAnalysisResult.extractedKeywords,
          extractedFeatures: urlAnalysisResult.extractedFeatures,
          extractedCategory: urlAnalysisResult.extractedCategory,
          extractedDescription: urlAnalysisResult.extractedDescription,
          targetAudience: urlAnalysisResult.targetAudience,
          useCases: urlAnalysisResult.useCases,
          urlAnalyzed: true,
          // Location detection
          detectedCountry: urlAnalysisResult.detectedCountry,
          detectedCountryCode: urlAnalysisResult.detectedCountryCode,
          isLocationBound: urlAnalysisResult.isLocationBound,
          // AI-assisted industry classification
          industryType: urlAnalysisResult.industryType,
          productType: urlAnalysisResult.productType,
          industryTerminology: urlAnalysisResult.industryTerminology,
        }
        
        // Merge discovered competitors with user-provided ones (avoid duplicates)
        const existingCompetitorsLower = input.competitors.map(c => c.toLowerCase())
        const newCompetitors = urlAnalysisResult.discoveredCompetitors.filter(
          comp => !existingCompetitorsLower.includes(comp.toLowerCase()) &&
                  comp.toLowerCase() !== input.brandName.toLowerCase()
        )
        
        enhancedInput.allCompetitors = [...input.competitors, ...newCompetitors]
        
        console.log(`URL Analysis found ${urlAnalysisResult.discoveredCompetitors.length} potential competitors`)
        console.log(`Combined competitors: ${enhancedInput.allCompetitors.join(", ")}`)
        if (urlAnalysisResult.detectedCountry) {
          console.log(`Detected country: ${urlAnalysisResult.detectedCountry} (location-bound: ${urlAnalysisResult.isLocationBound})`)
        }
      }
    } catch (error) {
      console.error("URL analysis failed, continuing with user input:", error)
    }
  }
  currentStep++

  // Use user-provided categories first, then enhanced category, then infer
  const userCategories = input.categories || []
  let primaryCategory = userCategories[0] || enhancedInput.extractedCategory || input.category || inferCategory(input.description)
  
  // Sanitize category - prevent "software" from being used for non-software companies
  // This catches cases where the AI incorrectly returns "software" for physical products or services
  const lowerCategory = primaryCategory.toLowerCase()
  const lowerDesc = input.description.toLowerCase()
  const brandLower = input.brandName.toLowerCase()
  
  if (lowerCategory === "software" || lowerCategory === "software tools" || lowerCategory === "software tool") {
    // Check if this is actually a physical product or service
    const physicalIndicators = [
      "clothing", "apparel", "wear", "fashion", "yoga", "fitness", "activewear", "sportswear",
      "shoes", "footwear", "accessories", "jewelry", "beauty", "skincare", "makeup",
      "food", "restaurant", "cafe", "grocery", "beverage",
      "car", "vehicle", "rental", "auto", "motor", "fleet",
      "hotel", "accommodation", "resort", "lodging",
      "insurance", "insurer", "coverage", "policy",
      "bank", "banking", "financial", "credit", "loan",
      "healthcare", "medical", "clinic", "hospital", "health",
      "real estate", "property", "realty", "realtor",
      "law", "legal", "attorney", "lawyer",
      "education", "school", "university", "training", "course",
      "travel", "tourism", "airline", "flight",
      "gym", "fitness center", "health club",
      "telecom", "mobile carrier", "internet provider",
      "delivery", "courier", "shipping", "logistics"
    ]
    
    const combinedText = `${lowerDesc} ${brandLower}`
    const foundIndicator = physicalIndicators.find(indicator => combinedText.includes(indicator))
    
    if (foundIndicator) {
      // Override with a more appropriate category
      primaryCategory = inferCategory(input.description)
      console.log(`Category sanitized: "software" -> "${primaryCategory}" based on indicator "${foundIndicator}"`)
    }
  }

  // Build enhanced description combining user input and extracted info
  const enhancedDescription = buildEnhancedDescription(input.description, enhancedInput)

  // Determine query count (default to 12 for free tier, 25 for paid)
  const queryCount = input.queryCount || 12

  // ===========================================
  // LOCATION DETECTION FROM USER INPUT
  // If the user's description mentions a specific country, detect it
  // ===========================================
  const userInputText = `${input.description} ${input.brandName} ${primaryCategory}`.toLowerCase()
  
  // Check for country mentions in user input
  const countryFromInput: { country: string; code: string } | null = (() => {
    if (/south africa|south african|\bza\b|johannesburg|cape town|pretoria|durban/i.test(userInputText)) {
      return { country: 'South Africa', code: 'ZA' }
    }
    if (/\bgermany\b|\bgerman\b|deutschland/i.test(userInputText)) {
      return { country: 'Germany', code: 'DE' }
    }
    if (/\bunited kingdom\b|\buk\b|\bbritish\b|\bengland\b/i.test(userInputText)) {
      return { country: 'United Kingdom', code: 'UK' }
    }
    if (/\baustralia\b|\baustralian\b/i.test(userInputText)) {
      return { country: 'Australia', code: 'AU' }
    }
    if (/\bnigeria\b|\bnigerian\b|\blagos\b/i.test(userInputText)) {
      return { country: 'Nigeria', code: 'NG' }
    }
    if (/\bindia\b|\bindian\b/i.test(userInputText)) {
      return { country: 'India', code: 'IN' }
    }
    if (/\bcanada\b|\bcanadian\b/i.test(userInputText)) {
      return { country: 'Canada', code: 'CA' }
    }
    if (/\bdubai\b|\buae\b|\bemirates\b|\babu dhabi\b/i.test(userInputText)) {
      return { country: 'United Arab Emirates', code: 'AE' }
    }
    if (/\bkenya\b|\bkenyan\b|\bnairobi\b/i.test(userInputText)) {
      return { country: 'Kenya', code: 'KE' }
    }
    if (/\bsingapore\b|\bsingaporean\b/i.test(userInputText)) {
      return { country: 'Singapore', code: 'SG' }
    }
    return null
  })()
  
  // If user input has country and URL analysis didn't detect one, use user's country
  if (countryFromInput && !enhancedInput.detectedCountry) {
    enhancedInput.detectedCountry = countryFromInput.country
    enhancedInput.detectedCountryCode = countryFromInput.code
    console.log(`Country detected from user input: ${countryFromInput.country}`)
  }

  // ===========================================
  // LOCATION-BOUND DETECTION
  // If we detected a country AND the category is typically location-specific,
  // ensure isLocationBound is set to true for geo-specific queries
  // ===========================================
  const LOCATION_BOUND_CATEGORIES = [
    // Financial services
    'insurance', 'health insurance', 'car insurance', 'life insurance', 'home insurance',
    'bank', 'banking', 'credit union', 'mortgage', 'loan', 'credit card',
    'investment', 'wealth management', 'financial advisor', 'tax', 'accounting',
    // Payment/Fintech
    'payment gateway', 'payment processor', 'payment solution', 'fintech', 'payments',
    'online payments', 'card payments', 'merchant services', 'payment provider',
    // Healthcare
    'healthcare', 'health care', 'hospital', 'clinic', 'doctor', 'dentist', 'medical',
    'pharmacy', 'health provider',
    // Legal
    'lawyer', 'attorney', 'legal', 'law firm',
    // Telecom
    'telecom', 'mobile carrier', 'internet provider', 'isp', 'phone carrier',
    // Real estate
    'real estate', 'property', 'housing', 'realtor',
    // Education
    'university', 'college', 'school', 'education',
    // Local services
    'car rental', 'vehicle rental', 'delivery', 'courier', 'shipping',
  ]
  
  // Check if category or description indicates a location-bound service
  const combinedCategoryText = `${primaryCategory} ${input.description}`.toLowerCase()
  const isLocationBoundCategory = LOCATION_BOUND_CATEGORIES.some(cat => 
    combinedCategoryText.includes(cat.toLowerCase())
  )
  
  // If we detected a country AND the category is location-bound, ensure isLocationBound is true
  if (enhancedInput.detectedCountry && isLocationBoundCategory && !enhancedInput.isLocationBound) {
    enhancedInput.isLocationBound = true
    console.log(`Location-bound override: category "${primaryCategory}" is location-specific, enabling geo-queries for ${enhancedInput.detectedCountry}`)
  }

  // Step 2: Generate queries using enhanced information
  reportProgress()
  
  // Use AI-detected industry type and terminology if available
  const aiIndustryType = enhancedInput.industryType || null
  const aiProductType = enhancedInput.productType || null
  const aiTerminology = enhancedInput.industryTerminology || null
  
  console.log(`[Scan] AI-detected: industry=${aiIndustryType}, productType=${aiProductType}, terminology=${aiTerminology?.singular || 'none'}`)
  
  const taggedQueries = generateTaggedQueries(
    input.brandName, 
    primaryCategory, 
    enhancedDescription,
    enhancedInput.allCompetitors,
    enhancedInput.extractedKeywords,
    enhancedInput.useCases,
    userCategories, // Pass user categories for multi-category queries
    queryCount, // Number of queries to generate
    enhancedInput.detectedCountry, // Location for geo-specific queries
    enhancedInput.isLocationBound, // Whether service is location-bound
    aiIndustryType, // AI-detected industry type
    aiProductType, // AI-detected product type
    aiTerminology // AI-detected terminology
  )
  
  // Add custom queries from user (if provided) - tagged as "general"
  const customQueries = input.customQueries || []
  const customTaggedQueries: TaggedQuery[] = customQueries.map(q => ({
    query: q,
    dimension: "general" as QueryDimension
  }))
  
  const allTaggedQueries = [...taggedQueries, ...customTaggedQueries]
  const queries = allTaggedQueries.map(tq => tq.query)
  
  // Track which queries are custom
  const customQuerySet = new Set(customQueries.map(q => q.toLowerCase()))
  
  currentStep++

  // Step 2 & 3: Query AI sources (in parallel where possible)
  reportProgress()
  const chatgptAvailable = isOpenAIConfigured()
  const claudeAvailable = isAnthropicConfigured()

  // Store raw responses for viewing
  const rawResponses: RawQueryResponse[] = queries.map(query => ({
    query,
    chatgpt_response: null,
    claude_response: null,
  }))

  let chatgptResponses: (string | null)[] = []
  let claudeResponses: (string | null)[] = []

  // Query ChatGPT with overall timeout
  const CHATGPT_OVERALL_TIMEOUT = 45000 // 45 seconds max for all ChatGPT queries
  
  if (chatgptAvailable) {
    try {
      chatgptResponses = new Array(queries.length).fill(null)
      
      const chatgptQueryPromise = Promise.all(
        queries.map(async (query, idx) => {
          try {
            const response = await queryChatGPT(query)
            rawResponses[idx].chatgpt_response = response
            chatgptResponses[idx] = response
            return response
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error)
            console.error(`[ChatGPT] Query ${idx + 1} failed: ${errorMsg}`)
            return null
          }
        })
      )
      
      // Race against overall timeout
      const timeoutPromise = new Promise<void>((resolve) => {
        setTimeout(() => {
          console.log(`[ChatGPT] Overall timeout reached (${CHATGPT_OVERALL_TIMEOUT}ms) - proceeding with partial results`)
          resolve()
        }, CHATGPT_OVERALL_TIMEOUT)
      })
      
      await Promise.race([chatgptQueryPromise, timeoutPromise])
      
      const successCount = chatgptResponses.filter(r => r !== null).length
      console.log(`[ChatGPT] Completed: ${successCount}/${queries.length} queries successful`)
      
    } catch (error) {
      console.error("[ChatGPT] All queries failed:", error)
      chatgptResponses = queries.map(() => null)
    }
  } else {
    console.log("[ChatGPT] Not configured, skipping")
    chatgptResponses = queries.map(() => null)
  }
  currentStep++

  // Query Claude - run all queries in parallel for speed
  reportProgress()
  if (claudeAvailable) {
    try {
      // Run ALL Claude queries in parallel - each has its own 15s timeout
      const CLAUDE_OVERALL_TIMEOUT = 60000 // 60 seconds max for all Claude queries
      
      claudeResponses = new Array(queries.length).fill(null)
      
      console.log(`[Claude] Starting ${queries.length} queries in parallel...`)
      
      // Run all queries in parallel - faster than batching
      const claudeQueryPromise = Promise.all(
        queries.map(async (query, idx) => {
          try {
            const response = await queryClaude(query)
            rawResponses[idx].claude_response = response
            claudeResponses[idx] = response
            return response
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error)
            console.error(`[Claude] Query ${idx + 1} failed: ${errorMsg}`)
            rawResponses[idx].claude_response = null
            return null
          }
        })
      )
      
      // Race against overall timeout
      const timeoutPromise = new Promise<void>((resolve) => {
        setTimeout(() => {
          console.log(`[Claude] Overall timeout reached (${CLAUDE_OVERALL_TIMEOUT}ms) - proceeding with partial results`)
          resolve()
        }, CLAUDE_OVERALL_TIMEOUT)
      })
      
      await Promise.race([claudeQueryPromise, timeoutPromise])
      
      // Log summary
      const successCount = claudeResponses.filter(r => r !== null).length
      console.log(`[Claude] Completed: ${successCount}/${queries.length} queries successful`)
      
    } catch (error) {
      console.error("[Claude] All queries failed:", error)
      claudeResponses = queries.map(() => null)
    }
  } else {
    console.log("[Claude] Not configured, skipping")
    claudeResponses = queries.map(() => null)
  }
  currentStep++

  // Step 4: Analyze responses
  reportProgress()
  const chatgptAnalyses: MentionAnalysis[] = []
  const claudeAnalyses: MentionAnalysis[] = []

  // Analyze ChatGPT and Claude responses IN PARALLEL for speed
  const [chatgptResults, claudeResults] = await Promise.all([
    // Analyze all ChatGPT responses in parallel
    Promise.all(
      chatgptResponses.map(async (response, i) => {
        const query = queries[i] || ""
        if (response) {
          try {
            return await analyzeResponse(response, input.brandName, input.competitors, query)
          } catch (error) {
            console.error("ChatGPT analysis error:", error)
            return createEmptyAnalysis()
          }
        }
        return createEmptyAnalysis()
      })
    ),
    // Analyze all Claude responses in parallel
    Promise.all(
      claudeResponses.map(async (response, i) => {
        const query = queries[i] || ""
        if (response) {
          try {
            return await analyzeResponse(response, input.brandName, input.competitors, query)
          } catch (error) {
            console.error("Claude analysis error:", error)
            return createEmptyAnalysis()
          }
        }
        return createEmptyAnalysis()
      })
    )
  ])
  
  chatgptAnalyses.push(...chatgptResults)
  claudeAnalyses.push(...claudeResults)
  currentStep++

  // Step 5: Compile results before signal detection
  const chatgptSource = compileSourceResult("chatgpt", chatgptAnalyses, input.description)
  const claudeSource = compileSourceResult("claude", claudeAnalyses, input.description, queries.length)

  // Check description accuracy if we have descriptions
  if (chatgptSource.description) {
    const accuracy = await checkDescriptionAccuracy(chatgptSource.description, input.description)
    chatgptSource.descriptionAccuracy = accuracy.accuracy
    chatgptSource.descriptionIssue = accuracy.issue
  }
  if (claudeSource.description) {
    const accuracy = await checkDescriptionAccuracy(claudeSource.description, input.description)
    claudeSource.descriptionAccuracy = accuracy.accuracy
    claudeSource.descriptionIssue = accuracy.issue
  }

  // Compile competitor results (needed for signals) - use all competitors including discovered ones
  const competitorResults = compileCompetitorResults(
    chatgptAnalyses,
    claudeAnalyses,
    enhancedInput.allCompetitors,
    chatgptSource.position === "top_3" || claudeSource.position === "top_3",
    input.competitors // Pass original competitors to mark discovered ones
  )

  // Detect signals
  reportProgress()
  const signals = detectSignals({
    brandName: input.brandName,
    brandUrl: input.brandUrl,
    userDescription: input.description,
    chatgptAnalyses,
    claudeAnalyses,
    competitors: input.competitors,
    competitorResults,
  })
  currentStep++

  // Step 6: Generate actions
  reportProgress()
  
  // Determine overall status
  const status = determineOverallStatus(chatgptAnalyses, claudeAnalyses)

  // Get the best AI description for action context
  const aiDescription = chatgptSource.description || claudeSource.description

  // Generate action plan with full context
  const actions = generateActions({
    signals,
    brandName: input.brandName,
    competitors: input.competitors,
    status,
    competitorResults,
    aiDescription,
    userDescription: input.description,
    sources: {
      chatgpt: chatgptSource,
      claude: claudeSource,
    },
  })

  // Compile query results with exact positions, dimensions, and variation groups
  const queriesTested = queries.map((query, idx) => ({
    query,
    chatgpt: chatgptAnalyses[idx]?.mentioned ?? false,
    claude: claudeAnalyses[idx]?.mentioned ?? false,
    chatgptPosition: chatgptAnalyses[idx]?.exactPosition ?? null,
    claudePosition: claudeAnalyses[idx]?.exactPosition ?? null,
    dimension: allTaggedQueries[idx]?.dimension ?? "general" as QueryDimension,
    isCustom: customQuerySet.has(query.toLowerCase()),
    variationGroup: allTaggedQueries[idx]?.variationGroup,
  }))

  // Calculate visibility score with dimension breakdown
  const visibilityScore = calculateVisibilityScore(chatgptAnalyses, claudeAnalyses, allTaggedQueries)

  // Generate "why not mentioned" analysis if brand is not well-mentioned
  const whyNotMentioned = status !== "recommended" 
    ? analyzeWhyNotMentioned(
        status,
        signals,
        competitorResults,
        urlAnalysisResult,
        input.brandName,
        primaryCategory
      )
    : undefined

  // Build content strategy for the result
  const contentStrategy = urlAnalysisResult?.contentStrategy ? {
    pagesAnalyzed: urlAnalysisResult.contentStrategy.pagesAnalyzed.length,
    hasComparisonPages: urlAnalysisResult.contentStrategy.hasComparisonPages,
    hasFAQSection: urlAnalysisResult.contentStrategy.hasFAQSection,
    hasFAQSchema: urlAnalysisResult.contentStrategy.hasFAQSchema,
    hasProductSchema: urlAnalysisResult.contentStrategy.hasProductSchema,
    hasCaseStudies: urlAnalysisResult.contentStrategy.hasCaseStudies,
    hasTestimonials: urlAnalysisResult.contentStrategy.hasTestimonials,
    hasPricingPage: urlAnalysisResult.contentStrategy.hasPricingPage,
    hasIntegrations: urlAnalysisResult.contentStrategy.hasIntegrations,
    valuePropositionClarity: urlAnalysisResult.contentStrategy.valuePropositionClarity,
    uniqueDifferentiators: urlAnalysisResult.contentStrategy.uniqueDifferentiators,
    missingContent: urlAnalysisResult.contentStrategy.missingContent,
    recommendations: urlAnalysisResult.contentStrategy.recommendations,
  } : undefined

  return {
    status,
    visibilityScore,
    sources: {
      chatgpt: chatgptSource,
      claude: claudeSource,
    },
    queries_tested: queriesTested,
    signals,
    actions,
    competitor_results: competitorResults,
    raw_responses: rawResponses,
    brandName: input.brandName,
    brandUrl: input.brandUrl,
    category: primaryCategory,
    timestamp: new Date().toISOString(),
    urlAnalysis: urlAnalysisResult ? {
      extractedKeywords: urlAnalysisResult.extractedKeywords,
      extractedFeatures: urlAnalysisResult.extractedFeatures,
      extractedDescription: urlAnalysisResult.extractedDescription,
      targetAudience: urlAnalysisResult.targetAudience,
      useCases: urlAnalysisResult.useCases,
      discoveredCompetitors: urlAnalysisResult.discoveredCompetitors,
      confidence: urlAnalysisResult.confidence,
    } : undefined,
    whyNotMentioned,
    contentStrategy,
  }
}

/**
 * Build an enhanced description combining user input with extracted website info
 */
function buildEnhancedDescription(
  userDescription: string,
  enhanced: EnhancedScanInput
): string {
  const parts = [userDescription]
  
  // Add extracted description if it provides new info
  if (enhanced.extractedDescription && 
      enhanced.extractedDescription.toLowerCase() !== userDescription.toLowerCase()) {
    // Only add if substantially different
    const overlap = calculateOverlap(userDescription, enhanced.extractedDescription)
    if (overlap < 0.5) {
      parts.push(enhanced.extractedDescription)
    }
  }
  
  // Add target audience if not in description
  if (enhanced.targetAudience && 
      !userDescription.toLowerCase().includes(enhanced.targetAudience.toLowerCase())) {
    parts.push(`Target audience: ${enhanced.targetAudience}`)
  }
  
  // Add key features
  if (enhanced.extractedFeatures.length > 0) {
    const newFeatures = enhanced.extractedFeatures.filter(
      f => !userDescription.toLowerCase().includes(f.toLowerCase())
    ).slice(0, 3)
    
    if (newFeatures.length > 0) {
      parts.push(`Key features: ${newFeatures.join(", ")}`)
    }
  }
  
  // Add use cases
  if (enhanced.useCases.length > 0) {
    const newUseCases = enhanced.useCases.filter(
      u => !userDescription.toLowerCase().includes(u.toLowerCase())
    ).slice(0, 2)
    
    if (newUseCases.length > 0) {
      parts.push(`Use cases: ${newUseCases.join(", ")}`)
    }
  }
  
  return parts.join(". ")
}

/**
 * Calculate word overlap between two strings (0-1)
 */
function calculateOverlap(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().split(/\s+/).filter(w => w.length > 3))
  const words2 = new Set(str2.toLowerCase().split(/\s+/).filter(w => w.length > 3))
  
  if (words1.size === 0 || words2.size === 0) return 0
  
  let overlap = 0
  for (const word of words1) {
    if (words2.has(word)) overlap++
  }
  
  return overlap / Math.min(words1.size, words2.size)
}

function createEmptyAnalysis(): MentionAnalysis {
  return {
    mentioned: false,
    position: "not_found",
    exactPosition: null,
    sentiment: null,
    description: null,
    competitors_mentioned: [],
    competitors_in_top_3: [],
    other_brands_mentioned: [],
    response_type: "unclear",
    confidence: 0,
  }
}

function determineOverallStatus(
  chatgptAnalyses: MentionAnalysis[],
  claudeAnalyses: MentionAnalysis[]
): VisibilityStatus {
  const allAnalyses = [...chatgptAnalyses, ...claudeAnalyses]
  const validAnalyses = allAnalyses.filter(a => a.confidence > 0)

  if (validAnalyses.length === 0) {
    return "not_mentioned"
  }

  const mentioned = validAnalyses.filter(a => a.mentioned)
  const mentionRatio = mentioned.length / validAnalyses.length

  // Check for top 3 positions
  const topPositions = mentioned.filter(a => a.position === "top_3")
  const hasRecommendedSentiment = mentioned.some(a => a.sentiment === "recommended")
  
  // If mentioned frequently with top positions or recommended sentiment
  if (mentionRatio >= 0.4 && (topPositions.length > 0 || hasRecommendedSentiment)) {
    return "recommended"
  } else if (mentionRatio >= 0.25 || mentioned.length > 0) {
    return "low_visibility"
  } else {
    return "not_mentioned"
  }
}

function compileSourceResult(
  source: "chatgpt" | "claude",
  analyses: MentionAnalysis[],
  userDescription: string,
  totalQueries?: number
): SourceResult {
  const validAnalyses = analyses.filter(a => a.confidence > 0)
  const mentionCount = validAnalyses.filter(a => a.mentioned).length
  const topThreeCount = validAnalyses.filter(a => a.position === "top_3").length
  const mentioned = mentionCount > 0

  // Find the best position
  let position: "top_3" | "mentioned" | "not_found" = "not_found"
  if (mentioned) {
    position = topThreeCount > 0 ? "top_3" : "mentioned"
  }

  // Get the most detailed description
  const descriptions = validAnalyses
    .filter(a => a.description)
    .map(a => a.description!)
    .sort((a, b) => b.length - a.length)

  const description = descriptions[0] || null

  // Get the most positive sentiment
  const sentiments = validAnalyses
    .filter(a => a.mentioned && a.sentiment)
    .map(a => a.sentiment!)
  
  const sentiment = sentiments.includes("recommended") 
    ? "recommended" 
    : sentiments.includes("neutral") 
      ? "neutral" 
      : sentiments.includes("negative")
        ? "negative"
        : null

  return {
    source,
    mentioned,
    position,
    sentiment,
    description,
    descriptionAccuracy: "not_mentioned",
    descriptionIssue: null,
    mentionCount,
    topThreeCount,
    totalQueries: totalQueries || analyses.length,
  }
}

function compileCompetitorResults(
  chatgptAnalyses: MentionAnalysis[],
  claudeAnalyses: MentionAnalysis[],
  allCompetitors: string[],
  userIsTopThree: boolean,
  userProvidedCompetitors: string[] = []
): CompetitorResult[] {
  const totalQueries = chatgptAnalyses.length + claudeAnalyses.length
  const userProvidedLower = userProvidedCompetitors.map(c => c.toLowerCase())
  
  // Compile results for all competitors (user-specified + discovered from URL analysis)
  const specifiedResults = allCompetitors.map(competitor => {
    const isUserProvided = userProvidedLower.includes(competitor.toLowerCase())
    // Check how often this competitor was mentioned
    const chatgptMentions = chatgptAnalyses.filter(
      a => a.competitors_mentioned.some(c => c.toLowerCase() === competitor.toLowerCase())
    ).length
    const claudeMentions = claudeAnalyses.filter(
      a => a.competitors_mentioned.some(c => c.toLowerCase() === competitor.toLowerCase())
    ).length
    const mentionCount = chatgptMentions + claudeMentions

    // Check how often in top 3
    const chatgptTop3 = chatgptAnalyses.filter(
      a => a.competitors_in_top_3.some(c => c.toLowerCase() === competitor.toLowerCase())
    ).length
    const claudeTop3 = claudeAnalyses.filter(
      a => a.competitors_in_top_3.some(c => c.toLowerCase() === competitor.toLowerCase())
    ).length
    const topThreeCount = chatgptTop3 + claudeTop3

    const mentionRatio = mentionCount / Math.max(totalQueries, 1)
    const topThreeRatio = topThreeCount / Math.max(mentionCount, 1)

    let visibilityLevel: "recommended" | "low_visibility" | "not_mentioned"
    if (mentionRatio >= 0.4 && topThreeRatio >= 0.3) {
      visibilityLevel = "recommended"
    } else if (mentionRatio >= 0.2) {
      visibilityLevel = "low_visibility"
    } else {
      visibilityLevel = "not_mentioned"
    }

    // Determine if this competitor outranks the user
    const outranksUser = visibilityLevel === "recommended" && !userIsTopThree

    return {
      name: competitor,
      mentioned: mentionCount > 0,
      mentionCount,
      topThreeCount,
      totalQueries,
      visibilityLevel,
      description: null,
      outranksUser,
      isDiscovered: !isUserProvided, // True if discovered from URL analysis, not user-provided
    }
  })

  // Now, discover other brands mentioned in responses that weren't in our list
  const allOtherBrands = new Map<string, { mentions: number; topThree: number }>()
  const competitorsLower = allCompetitors.map(c => c.toLowerCase())
  
  // Collect other brands from all analyses
  ;[...chatgptAnalyses, ...claudeAnalyses].forEach(analysis => {
    // Add from other_brands_mentioned
    analysis.other_brands_mentioned?.forEach(brand => {
      const brandLower = brand.toLowerCase()
      // Skip if it's a user-specified competitor
      if (competitorsLower.includes(brandLower)) return
      
      const existing = allOtherBrands.get(brandLower) || { mentions: 0, topThree: 0 }
      existing.mentions++
      allOtherBrands.set(brandLower, existing)
    })
    
    // Also check competitors_in_top_3 for discovered brands
    analysis.competitors_in_top_3?.forEach(brand => {
      const brandLower = brand.toLowerCase()
      if (competitorsLower.includes(brandLower)) return
      
      const existing = allOtherBrands.get(brandLower) || { mentions: 0, topThree: 0 }
      existing.topThree++
      if (!existing.mentions) existing.mentions = 1 // Ensure we count it
      allOtherBrands.set(brandLower, existing)
    })
  })

  // Convert discovered brands to CompetitorResults (limit to top 5 by mentions)
  const discoveredResults: CompetitorResult[] = Array.from(allOtherBrands.entries())
    .sort((a, b) => b[1].mentions - a[1].mentions)
    .slice(0, 5)
    .filter(([, data]) => data.mentions >= 2) // Only include if mentioned at least twice
    .map(([brandName, data]) => {
      const mentionRatio = data.mentions / Math.max(totalQueries, 1)
      const topThreeRatio = data.topThree / Math.max(data.mentions, 1)
      
      let visibilityLevel: "recommended" | "low_visibility" | "not_mentioned"
      if (mentionRatio >= 0.4 && topThreeRatio >= 0.3) {
        visibilityLevel = "recommended"
      } else if (mentionRatio >= 0.2) {
        visibilityLevel = "low_visibility"
      } else {
        visibilityLevel = "not_mentioned"
      }

      const outranksUser = visibilityLevel === "recommended" && !userIsTopThree

      // Capitalize first letter of each word
      const formattedName = brandName
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')

      return {
        name: formattedName,
        mentioned: true,
        mentionCount: data.mentions,
        topThreeCount: data.topThree,
        totalQueries,
        visibilityLevel,
        description: null,
        outranksUser,
        isDiscovered: true,
      }
    })

  // Combine specified and discovered results
  return [...specifiedResults, ...discoveredResults]
}

/**
 * Analyze why a brand is not being mentioned by AI
 */
function analyzeWhyNotMentioned(
  status: VisibilityStatus,
  signals: Signal[],
  competitorResults: CompetitorResult[],
  urlAnalysis: { confidence: number; extractedFeatures: string[]; extractedDescription: string | null } | null,
  brandName: string,
  category: string
): { reasons: string[]; suggestions: string[] } {
  const reasons: string[] = []
  const suggestions: string[] = []
  
  // Analyze based on status
  if (status === "not_mentioned") {
    reasons.push(`AI models don't seem to know about ${brandName} in the ${category} space`)
    suggestions.push("Build more online presence through content marketing and PR")
  } else if (status === "low_visibility") {
    reasons.push(`${brandName} is known but not recommended as a top choice`)
    suggestions.push("Focus on differentiation and clear positioning")
  }
  
  // Analyze signals for clues
  const warningSignals = signals.filter(s => s.status === "warning" || s.status === "error")
  for (const signal of warningSignals) {
    if (signal.name.toLowerCase().includes("comparison")) {
      reasons.push("No comparison content found on your website")
      suggestions.push("Create comparison pages vs. top competitors")
    }
    if (signal.name.toLowerCase().includes("positioning") || signal.name.toLowerCase().includes("unclear")) {
      reasons.push("Your product positioning may be unclear to AI models")
      suggestions.push("Clarify your unique value proposition on your homepage")
    }
    if (signal.name.toLowerCase().includes("content") || signal.name.toLowerCase().includes("thin")) {
      reasons.push("Limited content about your product's capabilities online")
      suggestions.push("Publish detailed feature pages and use case documentation")
    }
  }
  
  // Check competitor dominance
  const dominantCompetitors = competitorResults.filter(c => c.outranksUser && c.topThreeCount > 0)
  if (dominantCompetitors.length > 0) {
    const names = dominantCompetitors.slice(0, 3).map(c => c.name).join(", ")
    reasons.push(`Strong competitors (${names}) dominate the AI recommendations`)
    suggestions.push(`Study what ${dominantCompetitors[0]?.name || "competitors"} does well and differentiate`)
  }
  
  // Check URL analysis
  if (urlAnalysis) {
    if (urlAnalysis.confidence < 0.5) {
      reasons.push("Your website may not clearly communicate what your product does")
      suggestions.push("Improve your homepage messaging with clear headlines and descriptions")
    }
    if (urlAnalysis.extractedFeatures.length < 3) {
      reasons.push("Few distinct features were found on your website")
      suggestions.push("Create a dedicated features page highlighting your capabilities")
    }
    if (!urlAnalysis.extractedDescription) {
      reasons.push("No clear product description found in your website metadata")
      suggestions.push("Add a clear meta description and OG tags to your homepage")
    }
  }
  
  // Add general suggestions if we don't have enough
  if (suggestions.length < 2) {
    suggestions.push("Build credibility through customer testimonials and case studies")
    suggestions.push("Get mentioned in industry publications and review sites")
  }
  
  // Deduplicate and limit
  const uniqueReasons = [...new Set(reasons)].slice(0, 4)
  const uniqueSuggestions = [...new Set(suggestions)].slice(0, 4)
  
  return {
    reasons: uniqueReasons,
    suggestions: uniqueSuggestions,
  }
}

/**
 * Calculate a visibility score (0-100) based on mention analysis
 * 
 * Scoring system:
 * - Position 1 (first mentioned): 100 points
 * - Position 2: 90 points
 * - Position 3: 80 points
 * - Positions 4-5: 60 points
 * - Positions 6-10: 40 points
 * - Mentioned but no position: 30 points
 * - Not mentioned: 0 points
 * 
 * Final score = (total points / max possible points) * 100
 */
function calculateVisibilityScore(
  chatgptAnalyses: MentionAnalysis[],
  claudeAnalyses: MentionAnalysis[],
  taggedQueries: TaggedQuery[]
): VisibilityScore {
  const maxPointsPerQuery = 100
  
  // Calculate points for a single analysis
  function getPoints(analysis: MentionAnalysis): number {
    if (!analysis.mentioned) return 0
    
    const position = analysis.exactPosition
    if (position === null) {
      // Mentioned but no exact position - use category position
      return analysis.position === "top_3" ? 80 : 30
    }
    
    // Score based on exact position
    if (position === 1) return 100
    if (position === 2) return 90
    if (position === 3) return 80
    if (position <= 5) return 60
    if (position <= 10) return 40
    return 30 // Mentioned but very low position
  }
  
  // Calculate ChatGPT score
  const chatgptValidAnalyses = chatgptAnalyses.filter(a => a.confidence > 0)
  const chatgptPoints = chatgptValidAnalyses.reduce((sum, a) => sum + getPoints(a), 0)
  const chatgptMaxPoints = chatgptValidAnalyses.length * maxPointsPerQuery
  const chatgptScore = chatgptMaxPoints > 0 
    ? Math.round((chatgptPoints / chatgptMaxPoints) * 100) 
    : 0
  
  // Calculate Claude score
  const claudeValidAnalyses = claudeAnalyses.filter(a => a.confidence > 0)
  const claudePoints = claudeValidAnalyses.reduce((sum, a) => sum + getPoints(a), 0)
  const claudeMaxPoints = claudeValidAnalyses.length * maxPointsPerQuery
  const claudeScore = claudeMaxPoints > 0 
    ? Math.round((claudePoints / claudeMaxPoints) * 100) 
    : 0
  
  // Calculate overall score (weighted average of both models)
  const totalPoints = chatgptPoints + claudePoints
  const totalMaxPoints = chatgptMaxPoints + claudeMaxPoints
  const overallScore = totalMaxPoints > 0 
    ? Math.round((totalPoints / totalMaxPoints) * 100) 
    : 0
  
  // Calculate breakdown metrics
  const allAnalyses = [...chatgptValidAnalyses, ...claudeValidAnalyses]
  const mentionedAnalyses = allAnalyses.filter(a => a.mentioned)
  const topThreeAnalyses = allAnalyses.filter(a => a.position === "top_3")
  
  const mentionRate = allAnalyses.length > 0 
    ? Math.round((mentionedAnalyses.length / allAnalyses.length) * 100) 
    : 0
  
  const topThreeRate = mentionedAnalyses.length > 0 
    ? Math.round((topThreeAnalyses.length / mentionedAnalyses.length) * 100) 
    : 0
  
  // Calculate average position (when mentioned)
  const positions = mentionedAnalyses
    .map(a => a.exactPosition)
    .filter((p): p is number => p !== null)
  const avgPosition = positions.length > 0 
    ? Math.round((positions.reduce((sum, p) => sum + p, 0) / positions.length) * 10) / 10 
    : null
  
  // Calculate model consistency (both mention or both don't for each query)
  let consistentQueries = 0
  const queryCount = Math.min(chatgptAnalyses.length, claudeAnalyses.length)
  for (let i = 0; i < queryCount; i++) {
    const chatgptMentioned = chatgptAnalyses[i]?.mentioned ?? false
    const claudeMentioned = claudeAnalyses[i]?.mentioned ?? false
    if (chatgptMentioned === claudeMentioned) {
      consistentQueries++
    }
  }
  const modelConsistency = queryCount > 0 
    ? Math.round((consistentQueries / queryCount) * 100) 
    : 0
  
  // Calculate dimension scores
  const byDimension = calculateDimensionScores(
    chatgptAnalyses, 
    claudeAnalyses, 
    taggedQueries, 
    getPoints
  )
  
  return {
    overall: overallScore,
    breakdown: {
      mentionRate,
      avgPosition,
      topThreeRate,
      modelConsistency,
    },
    byModel: {
      chatgpt: chatgptScore,
      claude: claudeScore,
    },
    byDimension,
    trend: null, // Will be calculated when comparing to previous scans
  }
}

/**
 * Calculate scores broken down by query dimension
 */
function calculateDimensionScores(
  chatgptAnalyses: MentionAnalysis[],
  claudeAnalyses: MentionAnalysis[],
  taggedQueries: TaggedQuery[],
  getPoints: (analysis: MentionAnalysis) => number
): DimensionScore[] {
  const dimensionLabels: Record<QueryDimension, string> = {
    // Universal dimensions
    quality: "Quality",
    reputation: "Reputation",
    value: "Value for Money",
    customer_service: "Customer Service",
    
    // Software dimensions
    features: "Features", 
    performance: "Performance",
    ease_of_use: "Ease of Use",
    price: "Price",
    
    // Physical product dimensions
    style: "Style & Design",
    comfort: "Comfort & Fit",
    durability: "Durability",
    
    // Service dimensions
    convenience: "Convenience",
    reliability: "Reliability",
    selection: "Selection & Options",
    
    // Industry-specific dimensions
    coverage: "Coverage Options",          // Insurance
    claims_process: "Claims Process",      // Insurance
    fleet_quality: "Fleet Quality",        // Car rental
    rates_fees: "Rates & Fees",            // Banking
    digital_experience: "Digital Experience", // Banking
    expertise: "Expertise",                // Professional services
    communication: "Communication",        // Professional services
    food_quality: "Food Quality",          // Restaurants
    ambiance: "Ambiance",                  // Restaurants/Hotels
    cleanliness: "Cleanliness",            // Hotels/Healthcare
    location: "Location",                  // Hotels/Real estate
    amenities: "Amenities",                // Hotels
    wait_times: "Wait Times",              // Healthcare
    care_quality: "Quality of Care",       // Healthcare
    safety: "Safety",                      // Automotive/Travel
    network: "Network Coverage",           // Telecom/Healthcare
    
    // General fallback
    general: "General"
  }
  
  // Determine which dimensions are actually used in the queries
  const usedDimensions = new Set(taggedQueries.map(tq => tq.dimension))
  
  // Filter to only dimensions that have queries (excluding "general")
  const dimensions = Array.from(usedDimensions).filter(d => d !== "general") as QueryDimension[]
  
  const maxPointsPerQuery = 100
  
  return dimensions.map(dimension => {
    // Find queries for this dimension
    const queryIndices = taggedQueries
      .map((tq, idx) => tq.dimension === dimension ? idx : -1)
      .filter(idx => idx !== -1)
    
    if (queryIndices.length === 0) {
      return {
        dimension,
        label: dimensionLabels[dimension],
        score: 0,
        queriesCount: 0,
        mentionCount: 0
      }
    }
    
    // Calculate points for this dimension
    let totalPoints = 0
    let mentionCount = 0
    
    for (const idx of queryIndices) {
      const chatgptAnalysis = chatgptAnalyses[idx]
      const claudeAnalysis = claudeAnalyses[idx]
      
      if (chatgptAnalysis && chatgptAnalysis.confidence > 0) {
        totalPoints += getPoints(chatgptAnalysis)
        if (chatgptAnalysis.mentioned) mentionCount++
      }
      
      if (claudeAnalysis && claudeAnalysis.confidence > 0) {
        totalPoints += getPoints(claudeAnalysis)
        if (claudeAnalysis.mentioned) mentionCount++
      }
    }
    
    // Max points = queries × 2 models × 100
    const maxPoints = queryIndices.length * 2 * maxPointsPerQuery
    const score = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0
    
    return {
      dimension,
      label: dimensionLabels[dimension],
      score,
      queriesCount: queryIndices.length,
      mentionCount
    }
  }).filter(d => d.queriesCount > 0) // Only include dimensions that have queries
}
