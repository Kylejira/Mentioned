/**
 * Query Generation with Fixed Query Bank
 * 
 * CONSISTENCY STRATEGY:
 * 1. Use fixed query bank for known categories (same queries every time)
 * 2. Fall back to deterministic templates for unknown categories
 * 3. Always return exactly QUERIES_PER_SCAN queries
 */

import OpenAI from "openai"
import { ProductData } from "./extract-product"
import { getQueriesForScan } from "./query-bank"

// Configuration - FIXED query count for consistency
// With parallel execution, 20 queries complete in ~same time as fewer queries
// (limited by slowest response, not total count)
export const QUERIES_PER_SCAN = 20

// Initialize OpenAI client (only used for fallback)
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
 * Generate queries for a scan - uses fixed query bank for consistency
 * Always returns exactly QUERIES_PER_SCAN (20) queries
 * Now supports regional queries for location-specific products
 */
export async function generateQueries(
  productData: ProductData,
  queryCount: number = QUERIES_PER_SCAN
): Promise<GeneratedQuery[]> {
  const startTime = Date.now()
  const targetCount = QUERIES_PER_SCAN // Always use fixed count
  
  // Extract geography from product data
  const geography = productData.geography?.country
  const isRegional = geography && 
                     geography.toLowerCase() !== 'global' && 
                     geography.toLowerCase() !== 'worldwide'
  
  console.log(`[QueryGen] Getting ${targetCount} queries for: ${productData.product_name} (${productData.category})`)
  console.log(`[QueryGen] Geography: ${geography || 'Global'}${isRegional ? ' (regional queries will be generated)' : ''}`)
  
  // STEP 1: Try to get queries from fixed query bank (with geography if regional)
  const bankQueries = getQueriesForScan(productData.category, productData.product_name, geography)
  
  // Convert string queries to GeneratedQuery format
  const queries: GeneratedQuery[] = bankQueries.slice(0, targetCount).map((query, index) => ({
    query,
    type: categorizeQuery(query, productData.product_name),
    why: `Query #${index + 1} from fixed query bank`
  }))
  
  console.log(`[QueryGen] Got ${queries.length} queries from query bank`)
  
  // STEP 2: If query bank didn't have enough, add deterministic product-specific queries
  if (queries.length < targetCount) {
    const additionalNeeded = targetCount - queries.length
    const productQueries = createProductSpecificQueries(productData)
    
    // Add product-specific queries that aren't duplicates
    const existingQueryTexts = new Set(queries.map(q => q.query.toLowerCase()))
    for (const pq of productQueries) {
      if (queries.length >= targetCount) break
      if (!existingQueryTexts.has(pq.query.toLowerCase())) {
        queries.push(pq)
        existingQueryTexts.add(pq.query.toLowerCase())
      }
    }
    
    console.log(`[QueryGen] Added ${queries.length - bankQueries.length} product-specific queries`)
  }
  
  // STEP 3: Final padding with generic fallbacks if still not enough
  while (queries.length < targetCount) {
    const fallbacks = createFallbackQueries(productData, targetCount - queries.length)
    const existingQueryTexts = new Set(queries.map(q => q.query.toLowerCase()))
    for (const fb of fallbacks) {
      if (queries.length >= targetCount) break
      if (!existingQueryTexts.has(fb.query.toLowerCase())) {
        queries.push(fb)
      }
    }
  }
  
  const duration = Date.now() - startTime
  console.log(`[QueryGen] Returning exactly ${queries.length} queries in ${duration}ms`)
  
  // Return exactly targetCount queries
  return queries.slice(0, targetCount)
}

/**
 * Categorize a query by type based on its content
 */
function categorizeQuery(query: string, productName: string): "category" | "problem" | "comparison" | "recommendation" {
  const lowerQuery = query.toLowerCase()
  const lowerProduct = productName.toLowerCase()
  
  // Comparison queries
  if (lowerQuery.includes(" vs ") || 
      lowerQuery.includes("alternative") || 
      lowerQuery.includes("compare") ||
      lowerQuery.includes("comparison")) {
    return "comparison"
  }
  
  // Product-specific queries (recommendation type)
  if (lowerQuery.includes(lowerProduct) || 
      lowerQuery.includes("review") || 
      lowerQuery.includes("pros and cons") ||
      lowerQuery.includes("worth it") ||
      lowerQuery.includes("is it good")) {
    return "recommendation"
  }
  
  // Problem/use-case queries
  if (lowerQuery.includes("how do") || 
      lowerQuery.includes("how to") || 
      lowerQuery.includes("what tool") ||
      lowerQuery.includes("should i use")) {
    return "problem"
  }
  
  // Default to category query
  return "category"
}

/**
 * Create product-specific queries that include the product name
 * Now includes geographic context when available
 */
function createProductSpecificQueries(productData: ProductData): GeneratedQuery[] {
  const name = productData.product_name
  const category = productData.category?.toLowerCase() || "software"
  const audience = productData.target_audience?.who || "teams"
  const geography = productData.geography?.country
  const isRegional = geography && 
                     geography.toLowerCase() !== 'global' && 
                     geography.toLowerCase() !== 'worldwide'
  const inRegion = isRegional ? ` in ${geography}` : ""
  
  const competitors = [
    ...productData.competitors_mentioned,
    ...(productData.likely_competitors || [])
  ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 3)
  
  const queries: GeneratedQuery[] = [
    { query: `${name} alternatives${inRegion}`, type: "comparison", why: "Alternatives query" },
    { query: `Is ${name} good`, type: "recommendation", why: "Product evaluation" },
    { query: `${name} review`, type: "recommendation", why: "Review request" },
    { query: `What do you think of ${name}`, type: "recommendation", why: "Opinion query" },
    { query: `Tell me about ${name}`, type: "recommendation", why: "Product info" },
    { query: `Is ${name} worth it${inRegion}`, type: "recommendation", why: "Value evaluation" },
    { query: `${name} pros and cons`, type: "recommendation", why: "Balanced view" },
    { query: `Best ${name} alternatives${inRegion}`, type: "comparison", why: "Alternative search" }
  ]
  
  // Add competitor comparisons
  if (competitors[0]) {
    queries.push({ query: `${name} vs ${competitors[0]}`, type: "comparison", why: "Competitor comparison" })
  }
  if (competitors[1]) {
    queries.push({ query: `${name} vs ${competitors[1]}`, type: "comparison", why: "Competitor comparison" })
  }
  
  return queries
}

/**
 * Validate queries with AI before running them
 */
export async function validateQueries(
  queries: GeneratedQuery[],
  productData: ProductData
): Promise<ValidatedQuery[]> {
  const startTime = Date.now()
  console.log(`[QueryValidate] Validating ${queries.length} queries`)
  
  const client = getOpenAI()
  
  const validationPrompt = `You are a quality checker. Review these queries for a product called "${productData.product_name}" in the "${productData.category}" category.

QUERIES TO VALIDATE:
${queries.map((q, i) => `${i + 1}. "${q.query}" (type: ${q.type})`).join("\n")}

PRODUCT CONTEXT:
- Target audience: ${productData.target_audience.who}
- Geography: ${productData.geography.country}
- Category: ${productData.category}

For each query, check:
1. Does it make grammatical sense?
2. Would a real person actually ask this?
3. Is it relevant to the product category?
4. Is it specific enough (not too generic)?
5. Does it match the target audience?

Return JSON:
{
  "validated_queries": [
    {
      "index": 0,
      "query": "the query text",
      "valid": true or false,
      "issue": "if invalid, explain why in 5-10 words — otherwise null",
      "improved_query": "if invalid but fixable, provide improved version — otherwise null"
    }
  ]
}

Be strict but reasonable. A query is valid if a real person would ask it when looking for this type of software.

Return ONLY the JSON object.`

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini", // Faster model for validation
      messages: [{ role: "user", content: validationPrompt }],
      response_format: { type: "json_object" },
      temperature: 0.1 // Very low for consistent validation
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error("Empty response from OpenAI")
    }

    const parsed = JSON.parse(content) as { validated_queries: ValidationResult[] }
    
    // Build validated query list
    const validatedQueries: ValidatedQuery[] = []
    
    for (const validation of parsed.validated_queries) {
      const originalQuery = queries[validation.index]
      if (!originalQuery) continue
      
      if (validation.valid) {
        validatedQueries.push({
          query: validation.query,
          type: originalQuery.type,
          why: originalQuery.why,
          validated: true
        })
      } else if (validation.improved_query) {
        // Use the improved version
        validatedQueries.push({
          query: validation.improved_query,
          type: originalQuery.type,
          why: originalQuery.why,
          validated: true,
          wasImproved: true
        })
      }
      // Skip invalid queries that couldn't be improved
    }
    
    const duration = Date.now() - startTime
    console.log(`[QueryValidate] ${validatedQueries.length}/${queries.length} queries validated in ${duration}ms`)
    
    // Ensure we have at least 5 valid queries
    if (validatedQueries.length < 5) {
      console.log(`[QueryValidate] Adding fallback queries to reach minimum`)
      const fallbacks = createFallbackQueries(productData, 5 - validatedQueries.length)
      validatedQueries.push(...fallbacks.map(q => ({ ...q, validated: true })))
    }
    
    return validatedQueries

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[QueryValidate] Failed: ${errorMessage}`)
    
    // If validation fails, return original queries as validated
    return queries.map(q => ({ ...q, validated: true }))
  }
}

/**
 * Create fallback queries when AI generation fails
 */
function createFallbackQueries(productData: ProductData, count: number): GeneratedQuery[] {
  const queries: GeneratedQuery[] = []
  const category = productData.category || "software"
  const audience = productData.target_audience?.who || "businesses"
  const name = productData.product_name
  const geo = productData.geography?.country !== "Global" ? ` in ${productData.geography.country}` : ""
  
  const templates = [
    { query: `What is the best ${category} for ${audience}${geo}?`, type: "category" as const, why: "Category + audience query" },
    { query: `Can you recommend a ${category} tool?`, type: "recommendation" as const, why: "Recommendation request" },
    { query: `What do you think of ${name}?`, type: "comparison" as const, why: "Direct product query" },
    { query: `Is ${name} worth it for ${audience}?`, type: "comparison" as const, why: "Product evaluation query" },
    { query: `Best ${category} tools${geo}`, type: "category" as const, why: "Generic category query" },
    { query: `${name} alternatives`, type: "comparison" as const, why: "Alternatives query" },
    { query: `What ${category} should I use?`, type: "recommendation" as const, why: "Open recommendation" },
    { query: `Compare ${category} options for ${audience}`, type: "comparison" as const, why: "Comparison query" },
  ]
  
  return templates.slice(0, count)
}

// Types
export interface GeneratedQuery {
  query: string
  type: "category" | "problem" | "comparison" | "recommendation"
  why: string
}

export interface ValidatedQuery extends GeneratedQuery {
  validated: boolean
  wasImproved?: boolean
}

interface ValidationResult {
  index: number
  query: string
  valid: boolean
  issue: string | null
  improved_query: string | null
}
