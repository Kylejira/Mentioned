import OpenAI from "openai"
import type { MentionAnalysis, AnalysisResponse, AccuracyCheckResponse, ResponseQuality } from "./types"
import { isExactBrandMatch, findExactBrandPosition, countExactBrandMentions } from "./brand-matcher"

// Lazy initialization to avoid errors when API key is not set
let openai: OpenAI | null = null

function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null
  }
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openai
}

// ============================================================
// RESPONSE QUALITY SCORING
// Detects deflections, generic responses, and off-topic answers
// ============================================================

// Phrases that indicate the AI is deflecting or refusing to answer
const DEFLECTION_PHRASES = [
  "i don't have access to current",
  "i cannot provide specific",
  "i'm not able to recommend",
  "i can't recommend specific",
  "my knowledge cutoff",
  "as of my knowledge cutoff",
  "as of my last update",
  "i don't have real-time",
  "i cannot access real-time",
  "i'm unable to provide",
  "i cannot give specific recommendations",
  "i don't have information about",
  "consult with a professional",
  "consult a professional",
  "speak to an expert",
  "contact a specialist",
  "i cannot make specific recommendations",
  "it's best to do your own research",
  "i recommend doing your own research",
  "i suggest doing your own research",
  "without knowing your specific",
  "depends on your specific needs",
  "there are many factors to consider",
  "i can provide general guidance",
  "here's some general advice",
  "in general terms",
]

// Phrases that indicate a knowledge cutoff issue
const KNOWLEDGE_CUTOFF_PHRASES = [
  "my knowledge cutoff",
  "as of my last training",
  "my training data only goes",
  "i was trained on data up to",
  "i don't have information after",
  "as of 2023",
  "as of 2024",
  "as of 2025",
  "i cannot access information after",
  "my information may be outdated",
]

// Phrases that indicate refusal
const REFUSAL_PHRASES = [
  "i cannot endorse",
  "i'm not able to endorse",
  "i cannot recommend one over another",
  "i don't make recommendations",
  "it would be inappropriate for me",
  "i must remain neutral",
  "i cannot take sides",
  "i'm not in a position to",
]

// Phrases that indicate generic/unhelpful response
const GENERIC_PHRASES = [
  "there are many options",
  "it depends on your needs",
  "consider your requirements",
  "do your research",
  "read reviews",
  "compare options",
  "look at user reviews",
  "check online reviews",
  "each has its own strengths",
  "all have their pros and cons",
  "the best choice depends",
  "it really depends on",
  "there's no one-size-fits-all",
  "personal preference plays a role",
]

/**
 * Score the quality of an AI response
 */
export function scoreResponseQuality(response: string, query: string): ResponseQuality {
  const lowerResponse = response.toLowerCase()
  const lowerQuery = query.toLowerCase()
  
  let score = 100 // Start with perfect score
  let isDeflection = false
  let isGeneric = false
  let isOffTopic = false
  let hasSpecificBrands = false
  let issueType: ResponseQuality["issueType"] = "none"
  let issueDetail: string | null = null
  
  // Check for deflection phrases
  for (const phrase of DEFLECTION_PHRASES) {
    if (lowerResponse.includes(phrase)) {
      isDeflection = true
      issueType = "deflection"
      issueDetail = "AI deflected instead of giving specific recommendations"
      score -= 40
      break
    }
  }
  
  // Check for knowledge cutoff issues
  if (!isDeflection) {
    for (const phrase of KNOWLEDGE_CUTOFF_PHRASES) {
      if (lowerResponse.includes(phrase)) {
        issueType = "knowledge_cutoff"
        issueDetail = "AI mentioned knowledge cutoff limitations"
        score -= 30
        break
      }
    }
  }
  
  // Check for refusal
  if (issueType === "none") {
    for (const phrase of REFUSAL_PHRASES) {
      if (lowerResponse.includes(phrase)) {
        isDeflection = true
        issueType = "refusal"
        issueDetail = "AI refused to make specific recommendations"
        score -= 35
        break
      }
    }
  }
  
  // Check for generic phrases
  let genericCount = 0
  for (const phrase of GENERIC_PHRASES) {
    if (lowerResponse.includes(phrase)) {
      genericCount++
    }
  }
  if (genericCount >= 2) {
    isGeneric = true
    if (issueType === "none") {
      issueType = "generic"
      issueDetail = "Response is too generic without specific recommendations"
    }
    score -= Math.min(genericCount * 10, 30)
  }
  
  // Check if response mentions specific brands (look for capitalized words that could be brand names)
  const brandPattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g
  const potentialBrands = response.match(brandPattern) || []
  // Filter out common non-brand words
  const nonBrandWords = new Set([
    "The", "This", "That", "These", "Those", "Here", "There", "When", "Where", "What", "Which",
    "However", "Although", "Because", "Therefore", "Additionally", "Furthermore", "Moreover",
    "First", "Second", "Third", "Finally", "Overall", "Generally", "Typically", "Usually",
    "Consider", "Remember", "Important", "Note", "Please", "Thank", "Thanks"
  ])
  const filteredBrands = potentialBrands.filter(b => !nonBrandWords.has(b))
  hasSpecificBrands = filteredBrands.length >= 2
  
  if (!hasSpecificBrands && !isDeflection) {
    isGeneric = true
    if (issueType === "none") {
      issueType = "generic"
      issueDetail = "Response doesn't mention specific brands"
    }
    score -= 20
  }
  
  // Check if response is off-topic
  // Extract key topic words from the query
  const queryTopics = lowerQuery
    .replace(/[?.,!]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 4)
    .slice(0, 5)
  
  // Check if response contains relevant topic words
  const topicMatches = queryTopics.filter(topic => lowerResponse.includes(topic))
  if (topicMatches.length < Math.min(2, queryTopics.length) && response.length > 100) {
    isOffTopic = true
    if (issueType === "none") {
      issueType = "off_topic"
      issueDetail = "Response may not directly answer the query"
    }
    score -= 25
  }
  
  // Bonus for longer, detailed responses
  if (response.length > 500 && hasSpecificBrands) {
    score += 10
  }
  
  // Bonus for numbered lists (indicates structured recommendations)
  if (/\d+\.\s+[A-Z]/.test(response)) {
    score += 5
  }
  
  // Ensure score is within bounds
  score = Math.max(0, Math.min(100, score))
  
  // Determine final issue if score is low but no specific issue identified
  if (score < 50 && issueType === "none") {
    issueType = "generic"
    issueDetail = "Response quality is below threshold"
  }
  
  console.log(`[Quality] Score: ${score}, Deflection: ${isDeflection}, Generic: ${isGeneric}, HasBrands: ${hasSpecificBrands}`)
  
  return {
    score,
    isDeflection,
    isGeneric,
    isOffTopic,
    hasSpecificBrands,
    issueType: issueType === "none" ? null : issueType,
    issueDetail
  }
}

/**
 * Strip markdown formatting from text for cleaner brand detection
 */
function stripMarkdown(text: string): string {
  return text
    // Remove bold+italic (***text***)
    .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
    // Remove bold (**text**)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    // Remove italic (*text*)
    .replace(/\*([^*]+)\*/g, '$1')
    // Remove bold/italic with underscores
    .replace(/___([^_]+)___/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove markdown links but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove headers (## text)
    .replace(/^#{1,6}\s*/gm, '')
    // Remove bullet points
    .replace(/^[\s]*[-*+]\s*/gm, '')
    // Remove numbered lists
    .replace(/^[\s]*\d+\.\s*/gm, '')
    // Remove backticks (code formatting)
    .replace(/`([^`]+)`/g, '$1')
    // Remove remaining asterisks that might be left over
    .replace(/\*+/g, ' ')
}

/**
 * Analyze an AI response to determine if a brand was mentioned
 * @param query - The original query (used for quality scoring)
 */
export async function analyzeResponse(
  response: string,
  brandName: string,
  competitors: string[],
  query: string = "" // Optional query for quality scoring
): Promise<MentionAnalysis> {
  // Strip markdown for cleaner brand detection
  const cleanResponse = stripMarkdown(response)
  
  // Score response quality
  const responseQuality = scoreResponseQuality(response, query)
  
  // First, do a quick check for exact brand name match
  const quickCheck = quickBrandCheck(cleanResponse, brandName)
  
  // If brand is clearly not mentioned and no competitors found, skip the API call
  const foundCompetitors = findCompetitors(response, competitors)
  if (!quickCheck.possiblyMentioned && foundCompetitors.length === 0) {
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
      confidence: 0.9,
      responseQuality,
    }
  }

  const client = getOpenAIClient()
  
  // If no API key, use basic analysis with cleaned response
  if (!client) {
    return basicAnalysis(cleanResponse, brandName, competitors, quickCheck, responseQuality)
  }

  try {
    // Use cleaned response for analysis to avoid markdown confusion
    const analysisPrompt = buildAnalysisPrompt(cleanResponse, brandName, competitors)

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "user", content: analysisPrompt },
      ],
      max_tokens: 500,
      temperature: 0,
    })

    const content = completion.choices[0]?.message?.content || "{}"
    
    // Parse JSON response with fallback
    const parsed = parseJSONResponse<AnalysisResponse>(content)
    
    if (parsed) {
      // VERIFICATION STEP: Verify brand is in text, but be more lenient
      // Check both cleaned response AND original response (markdown might help identify brands)
      const brandInCleanedText = verifyBrandInText(cleanResponse, brandName)
      const brandInOriginalText = verifyBrandInText(response, brandName)
      const brandActuallyInText = brandInCleanedText || brandInOriginalText
      
      // Determine final mention status:
      // 1. If AI says mentioned AND we verify it -> definitely mentioned
      // 2. If AI says mentioned but we can't verify -> trust AI if it provided details (description)
      // 3. If AI says not mentioned -> trust AI
      let verifiedMentioned = false
      
      if (parsed.brand_mentioned) {
        if (brandActuallyInText) {
          // AI says yes + we found it = definitely mentioned
          verifiedMentioned = true
          console.log(`[Analysis] Brand verified: AI=true, Found=true`)
        } else if (parsed.brand_description && parsed.brand_description.length > 10) {
          // AI says yes + provided specific description = probably mentioned (trust AI)
          verifiedMentioned = true
          console.log(`[Analysis] Brand trusted: AI=true with description, Found=false`)
        } else {
          // AI says yes but no strong evidence = don't trust
          verifiedMentioned = false
          console.log(`[Analysis] Brand rejected: AI=true but no verification`)
        }
      } else {
        // AI says not mentioned - but double check ourselves
        if (brandActuallyInText) {
          // AI missed it but we found it
          verifiedMentioned = true
          console.log(`[Analysis] Brand found by verification: AI=false, Found=true`)
        } else {
          verifiedMentioned = false
          console.log(`[Analysis] Brand not mentioned: AI=false, Found=false`)
        }
      }
      
      return {
        mentioned: verifiedMentioned,
        position: verifiedMentioned 
          ? (parsed.brand_position === "top_3" ? "top_3" : 
             parsed.brand_position === "mentioned_not_top" ? "mentioned_not_top" : "not_found")
          : "not_found",
        exactPosition: verifiedMentioned && typeof parsed.brand_exact_position === "number" 
          ? parsed.brand_exact_position 
          : null,
        sentiment: verifiedMentioned ? (parsed.brand_sentiment || null) : null,
        description: verifiedMentioned ? (parsed.brand_description || null) : null,
        competitors_mentioned: Array.isArray(parsed.competitors_mentioned) 
          ? parsed.competitors_mentioned 
          : foundCompetitors,
        competitors_in_top_3: Array.isArray(parsed.competitors_in_top_3)
          ? parsed.competitors_in_top_3
          : [],
        other_brands_mentioned: Array.isArray(parsed.other_brands_mentioned)
          ? parsed.other_brands_mentioned
          : [],
        response_type: parsed.response_type || "unclear",
        confidence: verifiedMentioned ? 0.95 : 0.9,
        responseQuality,
      }
    }

    // Fallback to basic analysis if JSON parsing failed
    return basicAnalysis(cleanResponse, brandName, competitors, quickCheck, responseQuality)
  } catch (error) {
    console.error("Analysis error:", error)
    return basicAnalysis(cleanResponse, brandName, competitors, quickCheck, responseQuality)
  }
}

/**
 * Build the analysis prompt for structured JSON output
 */
function buildAnalysisPrompt(response: string, brandName: string, competitors: string[]): string {
  return `You are analyzing an AI assistant's response to a recommendation question.

The brand/company we're checking for: "${brandName}"
The competitors to check for: ${competitors.length > 0 ? competitors.join(", ") : "none specified"}

Here is the AI response to analyze:
"""
${response}
"""

Analyze carefully and respond ONLY with this JSON (no markdown, no other text):

{
  "brand_mentioned": boolean,
  "brand_position": "top_3" | "mentioned_not_top" | "not_mentioned",
  "brand_exact_position": number or null,
  "brand_sentiment": "recommended" | "neutral" | "negative" | null,
  "brand_description": "one sentence describing how the AI portrayed the brand/company, or null if not mentioned",
  "competitors_mentioned": ["list", "of", "competitor", "names", "found"],
  "competitors_in_top_3": ["competitors", "that", "were", "top", "recommendations"],
  "other_brands_mentioned": ["other", "brands", "companies", "products", "mentioned", "in", "response"],
  "response_type": "list_recommendations" | "single_recommendation" | "comparison" | "general_advice" | "unclear"
}

Rules:
- IMPORTANT: Brand matching is CASE-INSENSITIVE. "OUTsurance" matches "Outsurance" matches "outsurance".
- "brand_mentioned": Set to TRUE if the brand name appears ANYWHERE in the response, regardless of capitalization.
- "brand_exact_position": If the response has a numbered list, give the position number (1-10). If mentioned but not in a list, estimate based on order of appearance (1 = first mentioned). null if not mentioned.
- "top_3" means the brand was one of the first 3 specific recommendations OR was explicitly called a "top choice", "best option", or strongly recommended
- "mentioned_not_top" means it was named but not as a primary recommendation (e.g., "also consider", "another option", or just mentioned in passing)
- Check for common misspellings, variations, or different capitalizations of the brand name (e.g., "Notion" vs "notion.so", "OUTsurance" vs "Outsurance")
- "recommended" sentiment means the AI actively suggested using it
- "neutral" means mentioned without strong endorsement
- "negative" means the AI advised against it or highlighted significant problems
- For competitors_in_top_3, only include competitors that were explicitly recommended as top choices
- For other_brands_mentioned, list ALL other brands/companies/products mentioned that are NOT the brand or competitors`
}

/**
 * Check description accuracy against user's description
 */
export async function checkDescriptionAccuracy(
  aiDescription: string | null,
  userDescription: string
): Promise<AccuracyCheckResponse> {
  if (!aiDescription) {
    return { accuracy: "not_mentioned", issue: null }
  }

  const client = getOpenAIClient()
  
  if (!client) {
    // Basic text matching fallback
    return basicAccuracyCheck(aiDescription, userDescription)
  }

  try {
    const prompt = `The user describes their product as: "${userDescription}"

The AI described it as: "${aiDescription}"

How accurate is the AI's description? Consider whether the AI captured the core value proposition and use case. Respond with JSON only:

{
  "accuracy": "accurate" | "partially_accurate" | "inaccurate",
  "issue": "brief explanation of any mismatch, or null if accurate"
}

Rules:
- "accurate": AI's description captures the main purpose and target audience
- "partially_accurate": AI got some aspects right but missed key points or added incorrect info
- "inaccurate": AI's description doesn't match what the product actually does`

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
      temperature: 0,
    })

    const content = completion.choices[0]?.message?.content || "{}"
    const parsed = parseJSONResponse<AccuracyCheckResponse>(content)
    
    if (parsed) {
      return {
        accuracy: parsed.accuracy || "partially_accurate",
        issue: parsed.issue || null,
      }
    }

    return basicAccuracyCheck(aiDescription, userDescription)
  } catch (error) {
    console.error("Accuracy check error:", error)
    return basicAccuracyCheck(aiDescription, userDescription)
  }
}

/**
 * Basic accuracy check using text matching
 */
function basicAccuracyCheck(aiDescription: string, userDescription: string): AccuracyCheckResponse {
  const aiLower = aiDescription.toLowerCase()
  const userLower = userDescription.toLowerCase()

  // Extract key terms from user description (words > 4 chars)
  const userTerms = userLower
    .split(/\s+/)
    .filter(word => word.length > 4)
    .map(word => word.replace(/[^a-z]/g, ''))
    .filter(word => word.length > 4)
    .slice(0, 10)

  // Count how many key terms appear in AI description
  const matchingTerms = userTerms.filter(term => aiLower.includes(term))
  const matchRatio = matchingTerms.length / Math.max(userTerms.length, 1)

  if (matchRatio >= 0.5) {
    return { accuracy: "accurate", issue: null }
  } else if (matchRatio >= 0.25) {
    return { accuracy: "partially_accurate", issue: "AI description captures some but not all key aspects" }
  } else {
    return { accuracy: "inaccurate", issue: "AI's description doesn't match product positioning" }
  }
}

/**
 * Verify that the brand name is actually present in the text
 * Uses EXACT word boundary matching to prevent false positives
 * (e.g., "Cal" should NOT match "Calendar" or "Calendly")
 */
function verifyBrandInText(response: string, brandName: string): boolean {
  // First, strip any remaining markdown from the response
  const cleanedResponse = stripMarkdown(response)
  
  console.log(`[Brand Check] Looking for "${brandName}" in response (${cleanedResponse.length} chars)`)
  
  // Use the exact brand matcher which handles:
  // - Word boundaries (prevents "Cal" matching "Calendar")
  // - Domain TLDs (Cal.com matches both "Cal.com" and "Cal" as standalone)
  // - CamelCase variations (PayFast, Pay Fast, pay-fast)
  // - Special character escaping
  const isMatch = isExactBrandMatch(cleanedResponse, brandName)
  
  if (isMatch) {
    console.log(`[Brand Check] ✓ Exact word-boundary match found for "${brandName}"`)
    return true
  }
  
  // Also check original response with markdown (sometimes markdown helps identify brands)
  // Look for **BrandName** or ##BrandName patterns
  const lowerBrand = brandName.toLowerCase().trim()
  const markdownBrandRegex = new RegExp(`(?:\\*\\*|##\\s*\\*\\*?)${escapeRegex(lowerBrand)}(?:\\*\\*)?`, 'i')
  if (markdownBrandRegex.test(response.toLowerCase())) {
    console.log(`[Brand Check] ✓ Found brand in markdown formatting`)
    return true
  }
  
  console.log(`[Brand Check] ✗ "${brandName}" NOT found in response (exact match required)`)
  console.log(`[Brand Check] Response preview: "${cleanedResponse.substring(0, 200)}..."`)
  return false
}

/**
 * Quick check if brand might be mentioned (avoids unnecessary API calls)
 * Uses exact word boundary matching to prevent false positives
 */
function quickBrandCheck(response: string, brandName: string): { possiblyMentioned: boolean; exactMatch: boolean } {
  // Use the exact brand matcher for accurate detection
  const isMatch = isExactBrandMatch(response, brandName)
  
  if (isMatch) {
    return { possiblyMentioned: true, exactMatch: true }
  }
  
  // For multi-word brand names, check if the FIRST distinctive word is present as exact match
  const lowerBrand = brandName.toLowerCase()
  const brandParts = lowerBrand.split(/[\s\-_.]+/).filter(part => part.length > 0)
  
  if (brandParts.length > 1) {
    const firstPart = brandParts[0]
    // Only check first part if it's distinctive enough (4+ chars) and not too common
    if (firstPart.length >= 4) {
      const commonWords = ['best', 'good', 'great', 'free', 'easy', 'fast', 'safe', 'smart', 'quick', 'simple', 
                          'online', 'digital', 'global', 'local', 'first', 'direct', 'instant', 'express',
                          'payment', 'gateway', 'service', 'system', 'platform', 'solution', 'made', 'open', 'cloud']
      if (!commonWords.includes(firstPart)) {
        const wordBoundaryRegex = new RegExp(`\\b${escapeRegex(firstPart)}\\b`, 'i')
        if (wordBoundaryRegex.test(response)) {
          return { possiblyMentioned: true, exactMatch: false }
        }
      }
    }
  } else if (brandParts.length === 1) {
    // Single-word brand: check for variations
    const part = brandParts[0]
    if (part.length >= 3) {
      const wordBoundaryRegex = new RegExp(`\\b${escapeRegex(part)}\\b`, 'i')
      if (wordBoundaryRegex.test(response)) {
        return { possiblyMentioned: true, exactMatch: false }
      }
    }
  }
  
  return { possiblyMentioned: false, exactMatch: false }
}

/**
 * Escape special regex characters
 */
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Find which competitors are mentioned in a response (exact match only)
 */
function findCompetitors(response: string, competitors: string[]): string[] {
  return competitors.filter(comp => isExactBrandMatch(response, comp))
}

/**
 * Find which competitors appear in top 3 recommendations (exact match only)
 */
function findTopCompetitors(response: string, competitors: string[]): string[] {
  // Look for mentions in first part of response
  const firstPart = response.slice(0, 500)
  
  return competitors.filter(comp => {
    // Check if competitor is mentioned early in the response with exact matching
    const position = findExactBrandPosition(firstPart, comp)
    return position !== -1 && position < 300
  })
}

/**
 * Basic analysis when AI API is not available
 */
function basicAnalysis(
  response: string,
  brandName: string,
  competitors: string[],
  quickCheck: { possiblyMentioned: boolean; exactMatch: boolean },
  responseQuality?: ResponseQuality
): MentionAnalysis {
  const foundCompetitors = findCompetitors(response, competitors)
  const topCompetitors = findTopCompetitors(response, competitors)
  
  // Use exact word-boundary matching to check for brand mention
  // This prevents false positives like "Cal" matching "Calendar"
  const isMentioned = isExactBrandMatch(response, brandName)
  const brandIndex = isMentioned ? findExactBrandPosition(response, brandName) : -1
  
  // Determine position based on where brand appears
  let position: "top_3" | "mentioned_not_top" | "not_found" = "not_found"
  let exactPosition: number | null = null
  
  if (isMentioned && brandIndex !== -1) {
    // If mentioned in first 300 chars, likely top recommendation
    position = brandIndex < 300 ? "top_3" : "mentioned_not_top"
    // Estimate position based on character position (rough heuristic)
    exactPosition = brandIndex < 100 ? 1 : brandIndex < 200 ? 2 : brandIndex < 300 ? 3 : 5
  }

  return {
    mentioned: isMentioned,
    position,
    exactPosition,
    sentiment: isMentioned ? "neutral" : null,
    description: null,
    competitors_mentioned: foundCompetitors,
    competitors_in_top_3: topCompetitors,
    other_brands_mentioned: [],
    response_type: "unclear",
    confidence: 0.5,
    responseQuality,
  }
}

/**
 * Parse JSON from response, handling common AI formatting issues
 */
function parseJSONResponse<T>(response: string): T | null {
  // Try direct parse first
  try {
    return JSON.parse(response) as T
  } catch {
    // Try to extract JSON from markdown code blocks or surrounding text
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]) as T
      } catch {
        // JSON extraction failed
      }
    }
  }
  return null
}

/**
 * Compare AI description with user's description
 * @deprecated Use checkDescriptionAccuracy instead
 */
export function compareDescriptions(
  aiDescription: string | null,
  userDescription: string
): { match: "accurate" | "partial" | "inaccurate"; reason: string } {
  if (!aiDescription) {
    return { match: "inaccurate", reason: "No description provided by AI" }
  }

  const result = basicAccuracyCheck(aiDescription, userDescription)
  
  return {
    match: result.accuracy === "accurate" ? "accurate" : 
           result.accuracy === "partially_accurate" ? "partial" : "inaccurate",
    reason: result.issue || "AI description aligns with your positioning",
  }
}
