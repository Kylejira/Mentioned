/**
 * AI-Powered Mention Detection
 * Uses AI to accurately detect if a product is mentioned in responses
 * Now includes fallback string matching for reliability
 */

import OpenAI from "openai"
import { ProductData } from "./extract-product"
import { QueryResult } from "./run-queries"

// Initialize OpenAI client
let openai: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured")
    }
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return openai
}

/**
 * Quick string-based mention check (fallback)
 * Handles case-insensitivity, special characters, and variations
 */
function quickMentionCheck(response: string, productName: string, variations: string[] = []): { found: boolean; evidence: string | null } {
  if (!response || !productName) {
    return { found: false, evidence: null }
  }
  
  const lowerResponse = response.toLowerCase()
  
  // Build list of names to check
  const namesToCheck = [productName, ...variations].filter(Boolean)
  
  for (const name of namesToCheck) {
    const lowerName = name.toLowerCase()
    
    // Check 1: Exact match (case-insensitive)
    if (lowerResponse.includes(lowerName)) {
      // Find the evidence - get surrounding context
      const index = lowerResponse.indexOf(lowerName)
      const start = Math.max(0, index - 20)
      const end = Math.min(response.length, index + lowerName.length + 50)
      const evidence = response.substring(start, end).trim()
      return { found: true, evidence: `...${evidence}...` }
    }
    
    // Check 2: Without special characters (Cal.com → calcom, Cal-com → calcom)
    const cleanName = lowerName.replace(/[^a-z0-9]/g, '')
    const cleanResponse = lowerResponse.replace(/[^a-z0-9\s]/g, '')
    if (cleanName.length > 2 && cleanResponse.includes(cleanName)) {
      // Find evidence from original response
      const index = cleanResponse.indexOf(cleanName)
      const start = Math.max(0, index - 20)
      const end = Math.min(response.length, index + cleanName.length + 50)
      const evidence = response.substring(start, end).trim()
      return { found: true, evidence: `...${evidence}...` }
    }
    
    // Check 3: With spaces instead of dots/hyphens (Cal.com → cal com)
    const spacedName = lowerName.replace(/[.\-_]/g, ' ').replace(/\s+/g, ' ').trim()
    if (spacedName !== lowerName && lowerResponse.includes(spacedName)) {
      const index = lowerResponse.indexOf(spacedName)
      const start = Math.max(0, index - 20)
      const end = Math.min(response.length, index + spacedName.length + 50)
      const evidence = response.substring(start, end).trim()
      return { found: true, evidence: `...${evidence}...` }
    }
  }
  
  return { found: false, evidence: null }
}

/**
 * Detect if a product is mentioned in a single response
 * Uses AI detection with string-matching fallback
 */
export async function detectMention(
  response: string,
  productData: ProductData
): Promise<MentionResult> {
  // Debug logging
  console.log("=== MENTION DETECTION DEBUG ===")
  console.log("Product name:", productData.product_name)
  console.log("Variations:", productData.product_name_variations?.join(", ") || "none")
  console.log("Response length:", response?.length || 0)
  console.log("Response preview:", response?.substring(0, 200) || "empty")
  
  if (!response || response.trim().length === 0) {
    console.log("Result: Empty response - not mentioned")
    return {
      mentioned: false,
      confidence: "high",
      evidence: "Empty response",
      position: null,
      context: "not mentioned",
      sentiment: "not mentioned"
    }
  }
  
  // STEP 1: Quick string check first (fast fallback)
  const quickCheck = quickMentionCheck(
    response, 
    productData.product_name, 
    productData.product_name_variations || []
  )
  console.log("Quick check result:", quickCheck.found, "| Evidence:", quickCheck.evidence?.substring(0, 50))
  
  const client = getOpenAI()
  
  const detectionPrompt = `You are analyzing an AI response to determine if a specific product is mentioned.

PRODUCT TO FIND:
- Product name: "${productData.product_name}"
- Also known as: ${productData.product_name_variations.join(", ")}
- Company name: "${productData.company_name}"
- What it does: "${productData.one_line_description}"

AI RESPONSE TO ANALYZE:
"""
${response.substring(0, 8000)}
"""

TASK:
Determine if the product above is mentioned in the AI response.

RULES:
1. The product IS mentioned if:
   - The exact product name appears (case-insensitive)
   - A known variation of the name appears
   - The company name is used to refer to the product
   - It's clearly being recommended, listed, or discussed

2. The product is NOT mentioned if:
   - It doesn't appear at all
   - A similar-sounding but different product is mentioned (e.g., "FreshDesk" is not "FreshBooks")
   - Only the category is mentioned but not this specific product
   - A generic word that happens to be in the product name is used differently

3. Be CAREFUL of:
   - Partial matches (e.g., "Hub" is not "HubSpot", "Fresh" is not "FreshBooks")
   - Generic words that happen to be in the product name
   - Different products with similar names
   - Possessive forms count as mentions (e.g., "HubSpot's CRM" = mentioned)

4. For POSITION:
   - Count which position the product appears in a list (1 = first, 2 = second, etc.)
   - If not in a numbered/bulleted list, estimate based on order of appearance
   - If not mentioned, position is null

Return JSON:
{
  "mentioned": true or false,
  "confidence": "high" | "medium" | "low",
  "evidence": "The exact text snippet where it was mentioned, or 'not found' if not mentioned",
  "position": number or null (1 = first mentioned in list, 2 = second, etc. — null if not in a list or not mentioned),
  "context": "recommended" | "compared" | "listed" | "discussed" | "mentioned_negatively" | "not mentioned",
  "sentiment": "positive" | "neutral" | "negative" | "not mentioned"
}

IMPORTANT: Be accurate. False positives (saying mentioned when it's not) and false negatives (saying not mentioned when it is) are both bad. When in doubt, look for the EXACT product name or its known variations.

Return ONLY the JSON object.`

  try {
    const aiResponse = await client.chat.completions.create({
      model: "gpt-4o-mini", // Use gpt-4o-mini for speed (still accurate for detection)
      messages: [{ role: "user", content: detectionPrompt }],
      response_format: { type: "json_object" },
      temperature: 0.1 // Very low for consistent detection
    })

    const content = aiResponse.choices[0]?.message?.content
    if (!content) {
      throw new Error("Empty response from OpenAI")
    }

    const result = JSON.parse(content) as MentionResult
    console.log("AI detection result:", result.mentioned, "| Evidence:", result.evidence?.substring(0, 50))
    
    // CRITICAL: If AI says not mentioned but quick check found it, trust quick check
    // This handles cases where AI hallucinated or made an error
    if (!result.mentioned && quickCheck.found) {
      console.warn(`[DetectMention] AI said not mentioned but string check found "${productData.product_name}" - trusting string check`)
      return {
        mentioned: true,
        confidence: "medium",
        evidence: quickCheck.evidence || "Found via string matching",
        position: result.position,
        context: "listed",
        sentiment: "neutral"
      }
    }
    
    // If AI says mentioned, verify with quick check for extra confidence
    if (result.mentioned && !quickCheck.found) {
      console.warn(`[DetectMention] AI said mentioned but string check didn't find it - still trusting AI (may be variation)`)
    }
    
    console.log("Final result: mentioned =", result.mentioned)
    return result

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[DetectMention] AI detection failed: ${errorMessage}`)
    
    // FALLBACK: If AI fails, use string check result
    if (quickCheck.found) {
      console.log(`[DetectMention] Using string check fallback: FOUND`)
      return {
        mentioned: true,
        confidence: "medium",
        evidence: quickCheck.evidence || "Found via string matching (AI detection failed)",
        position: null,
        context: "listed",
        sentiment: "neutral"
      }
    }
    
    console.log(`[DetectMention] Using string check fallback: NOT FOUND`)
    return {
      mentioned: false,
      confidence: "low",
      evidence: `Detection failed: ${errorMessage}`,
      position: null,
      context: "not mentioned",
      sentiment: "not mentioned"
    }
  }
}

/**
 * Extract all competitors mentioned in a response
 */
export async function extractCompetitors(
  response: string,
  productData: ProductData
): Promise<CompetitorMention[]> {
  if (!response || response.trim().length === 0) {
    return []
  }
  
  const client = getOpenAI()
  
  const extractionPrompt = `You are analyzing an AI response to find all software products/brands mentioned.

CATEGORY CONTEXT: ${productData.category}
USER'S PRODUCT: ${productData.product_name} (EXCLUDE this from the competitor list)
PRODUCT VARIATIONS TO EXCLUDE: ${productData.product_name_variations.join(", ")}

AI RESPONSE:
"""
${response.substring(0, 8000)}
"""

TASK:
Find ALL software products, tools, apps, or brands mentioned in this response.

RULES:
1. Only include actual product/brand names, not generic terms
2. Do NOT include the user's product (${productData.product_name}) or any of its variations
3. Include the position where each brand appears (1 = first in list, 2 = second, etc.)
4. Normalize names (e.g., "hubspot" → "HubSpot", "asana" → "Asana")
5. Don't include generic categories (e.g., "CRM tools") — only specific brand names

Return JSON:
{
  "competitors": [
    {
      "name": "Brand name with proper capitalization",
      "position": 1,
      "context": "How it was mentioned: recommended | compared | listed | discussed"
    }
  ]
}

If no competitors are found, return: { "competitors": [] }

Return ONLY the JSON object.`

  try {
    const aiResponse = await client.chat.completions.create({
      model: "gpt-4o-mini", // Faster model is fine for extraction
      messages: [{ role: "user", content: extractionPrompt }],
      response_format: { type: "json_object" },
      temperature: 0.1
    })

    const content = aiResponse.choices[0]?.message?.content
    if (!content) {
      console.warn(`[ExtractCompetitors] Empty response from AI`)
      return []
    }

    const result = JSON.parse(content) as { competitors: CompetitorMention[] }
    const competitors = result.competitors || []
    
    if (competitors.length > 0) {
      console.log(`[ExtractCompetitors] Found ${competitors.length} competitors: ${competitors.map(c => c.name).join(', ')}`)
    }
    
    return competitors

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[ExtractCompetitors] Failed: ${errorMessage}`)
    return []
  }
}

/**
 * Analyze all query results for mentions and competitors
 */
export async function analyzeAllResponses(
  queryResults: QueryResult[],
  productData: ProductData
): Promise<AnalyzedResult[]> {
  const startTime = Date.now()
  console.log(`[Analyze] Analyzing ${queryResults.length} query results`)
  
  // Process all analyses in parallel
  const analyzed = await Promise.all(
    queryResults.map(async (result) => {
      // Analyze ChatGPT and Claude responses in parallel
      const [chatgptAnalysis, claudeAnalysis] = await Promise.all([
        analyzeResponse(result.chatgpt.raw_response, productData),
        analyzeResponse(result.claude.raw_response, productData)
      ])
      
      return {
        query: result.query,
        type: result.type,
        chatgpt: {
          raw_response: result.chatgpt.raw_response,
          error: result.chatgpt.error,
          ...chatgptAnalysis
        },
        claude: {
          raw_response: result.claude.raw_response,
          error: result.claude.error,
          ...claudeAnalysis
        }
      }
    })
  )
  
  const duration = Date.now() - startTime
  console.log(`[Analyze] Completed analysis in ${duration}ms`)
  
  return analyzed
}

/**
 * Analyze a single response for mention and competitors
 */
async function analyzeResponse(
  response: string | null,
  productData: ProductData
): Promise<ResponseAnalysis> {
  if (!response) {
    return {
      mentioned: false,
      confidence: "high",
      evidence: "No response",
      position: null,
      context: "not mentioned",
      sentiment: "not mentioned",
      competitors: []
    }
  }
  
  // Run mention detection and competitor extraction in parallel
  const [mentionResult, competitors] = await Promise.all([
    detectMention(response, productData),
    extractCompetitors(response, productData)
  ])
  
  return {
    ...mentionResult,
    competitors
  }
}

// Types
export interface MentionResult {
  mentioned: boolean
  confidence: "high" | "medium" | "low"
  evidence: string
  position: number | null
  context: "recommended" | "compared" | "listed" | "discussed" | "mentioned_negatively" | "not mentioned"
  sentiment: "positive" | "neutral" | "negative" | "not mentioned"
}

export interface CompetitorMention {
  name: string
  position: number
  context: "recommended" | "compared" | "listed" | "discussed"
}

export interface ResponseAnalysis extends MentionResult {
  competitors: CompetitorMention[]
}

export interface AnalyzedResult {
  query: string
  type: "category" | "problem" | "comparison" | "recommendation"
  chatgpt: {
    raw_response: string | null
    error: string | null
  } & ResponseAnalysis
  claude: {
    raw_response: string | null
    error: string | null
  } & ResponseAnalysis
}
