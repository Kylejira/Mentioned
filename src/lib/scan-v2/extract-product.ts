/**
 * AI-Powered Product Data Extraction
 * Uses GPT-4o to extract structured product information from website content
 */

import OpenAI from "openai"

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
 * Extract structured product data from scraped website content
 */
export async function extractProductData(
  rawContent: string,
  productName: string,
  url: string
): Promise<ProductData> {
  const startTime = Date.now()
  console.log(`[Extract] Starting AI extraction for: ${productName}`)
  
  const client = getOpenAI()
  
  const extractionPrompt = `You are an expert at analyzing product websites. Your job is to deeply understand what a product does, who it's for, and how it competes in its market.

PRODUCT NAME PROVIDED BY USER: "${productName}"
WEBSITE URL: "${url}"

WEBSITE CONTENT (may include multiple pages):
"""
${rawContent.substring(0, 40000)}
"""

ANALYZE THE WEBSITE AND EXTRACT:

{
  "product_name": "The exact product name (use user-provided name if it matches the site)",
  "product_name_variations": ["All ways to refer to this product: full name, lowercase, no spaces, abbreviations, possessive forms"],
  "company_name": "Company name if different from product, otherwise same as product_name",
  "one_line_description": "What the product does in ONE clear sentence",
  
  "category": "CRITICAL: The PRIMARY category that best describes what this product is. Be SPECIFIC, not generic.
    - For issue tracking → 'Project Management' or 'Issue Tracking'
    - For CRM software → 'CRM' or 'Sales CRM'
    - For yoga clothes → 'Activewear' or 'Yoga Apparel'
    - For car rentals → 'Car Rental'
    - For insurance → 'Insurance' (add type: 'Health Insurance', 'Car Insurance')
    - NEVER just say 'Software' or 'Tool' - be specific about the industry/function",
    
  "subcategories": ["2-3 related categories this could also fit in"],
  
  "product_type": "Identify: 'software' | 'physical_product' | 'service' | 'marketplace' | 'content'",
  
  "target_audience": {
    "who": "Primary user persona (e.g., 'software developers', 'small business owners', 'fitness enthusiasts')",
    "company_size": "Target company size if B2B (solo, SMB, mid-market, enterprise), or 'consumers' if B2C",
    "industry": "Specific industry/vertical if any (tech, healthcare, finance, etc.), otherwise 'general'"
  },
  
  "key_features": ["Top 5-7 features - be specific about what makes them notable"],
  
  "use_cases": ["Specific problems this solves. Be concrete:
    - BAD: 'helps with projects'
    - GOOD: 'track bugs and issues for software development teams'
    - GOOD: 'manage sprint planning and agile workflows'"],
    
  "competitors_mentioned": ["ONLY brands explicitly named on their site. Do NOT guess or invent competitors."],
  
  "likely_competitors": ["Based on the category and features, who are the obvious competitors? This helps with query generation."],
  
  "integrations": ["Tools/platforms they integrate with"],
  
  "pricing_model": "How they charge (free, freemium, subscription, per-seat, usage-based, enterprise-only)",
  
  "geography": {
    "country": "If they serve a specific country/region, name it. Look for: currency (€, £, R, etc.), phone formats, addresses, .de/.uk domains, local references. Otherwise 'Global'",
    "evidence": "What made you determine this?"
  },
  
  "unique_selling_points": ["2-3 things that differentiate them from alternatives"],
  
  "brand_voice": "How do they position themselves? (professional, playful, technical, simple, premium, affordable)"
}

CRITICAL RULES:
1. CATEGORY must be specific - never generic terms like "Software" or "Tool"
2. Detect PRODUCT TYPE correctly - physical products need different queries than software
3. For GEOGRAPHY - look carefully for regional indicators (currency symbols, addresses, local brands mentioned)
4. COMPETITORS_MENTIONED = only what's on their site. LIKELY_COMPETITORS = your knowledge of the market
5. Be SPECIFIC in use_cases - these become the basis for search queries

Return ONLY the JSON object.`

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: extractionPrompt }],
      response_format: { type: "json_object" },
      temperature: 0.2 // Low temperature for consistent extraction
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error("Empty response from OpenAI")
    }

    const extracted = JSON.parse(content) as ExtractedProductData
    
    // Generate comprehensive variations using our helper function
    // This ensures we catch all forms: Cal.com, cal.com, Calcom, calcom, Cal com, etc.
    const autoVariations = generateProductNameVariations(productName)
    const aiVariations = extracted.product_name_variations || []
    
    // Merge AI-provided variations with auto-generated ones
    const allVariations = new Set<string>([
      ...autoVariations,
      ...aiVariations,
      ...aiVariations.map(v => v.toLowerCase()),
      extracted.product_name,
      extracted.product_name.toLowerCase(),
    ])
    
    // Also add company name variations if different from product
    if (extracted.company_name && extracted.company_name !== extracted.product_name) {
      const companyVariations = generateProductNameVariations(extracted.company_name)
      companyVariations.forEach(v => allVariations.add(v))
    }
    
    extracted.product_name_variations = Array.from(allVariations).filter(v => v.length >= 2)
    
    console.log(`[Extract] Total variations: ${extracted.product_name_variations.length}`)
    
    const duration = Date.now() - startTime
    console.log(`[Extract] Completed in ${duration}ms`)
    console.log(`[Extract] Category: "${extracted.category}"`)
    console.log(`[Extract] Product type: "${extracted.product_type || 'software'}"`)
    console.log(`[Extract] Target audience: ${extracted.target_audience?.who}`)
    console.log(`[Extract] Geography: ${extracted.geography?.country}`)
    console.log(`[Extract] Likely competitors: ${extracted.likely_competitors?.join(', ') || 'none'}`)
    
    return {
      ...extracted,
      product_type: extracted.product_type || "software",
      likely_competitors: extracted.likely_competitors || [],
      brand_voice: extracted.brand_voice || "professional",
      url,
      raw_content_length: rawContent.length
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[Extract] Failed: ${errorMessage}`)
    
    // Return minimal fallback data
    return createFallbackProductData(productName, url)
  }
}

/**
 * Generate comprehensive variations of a product name
 * Handles special characters, domains, casing, etc.
 */
export function generateProductNameVariations(productName: string): string[] {
  const variations = new Set<string>()
  
  // Original name
  variations.add(productName)
  
  // Lowercase
  variations.add(productName.toLowerCase())
  
  // Uppercase
  variations.add(productName.toUpperCase())
  
  // Title case
  variations.add(productName.replace(/\w\S*/g, txt => 
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  ))
  
  // Without special characters (Cal.com → Calcom)
  const noSpecialChars = productName.replace(/[^a-zA-Z0-9]/g, '')
  variations.add(noSpecialChars)
  variations.add(noSpecialChars.toLowerCase())
  
  // Replace dots with spaces (Cal.com → Cal com)
  const dotsToSpaces = productName.replace(/\./g, ' ').trim()
  if (dotsToSpaces !== productName) {
    variations.add(dotsToSpaces)
    variations.add(dotsToSpaces.toLowerCase())
  }
  
  // Replace hyphens with spaces
  const hyphensToSpaces = productName.replace(/-/g, ' ').trim()
  if (hyphensToSpaces !== productName) {
    variations.add(hyphensToSpaces)
    variations.add(hyphensToSpaces.toLowerCase())
  }
  
  // No spaces
  const noSpaces = productName.replace(/\s+/g, '')
  variations.add(noSpaces)
  variations.add(noSpaces.toLowerCase())
  
  // Handle .com, .io, .ai domains - include version without domain extension
  const domainMatch = productName.match(/^(.+)\.(com|io|ai|co|app|dev)$/i)
  if (domainMatch) {
    const baseName = domainMatch[1]
    variations.add(baseName)
    variations.add(baseName.toLowerCase())
    variations.add(baseName.toUpperCase())
  }
  
  // Possessive forms (Cal.com's, Cal.coms)
  variations.add(`${productName}'s`)
  variations.add(`${productName.toLowerCase()}'s`)
  
  // Filter out empty strings and very short ones
  const result = Array.from(variations).filter(v => v.length >= 2)
  
  console.log(`[Extract] Generated ${result.length} variations for "${productName}":`, result.slice(0, 5).join(', '), result.length > 5 ? '...' : '')
  
  return result
}

/**
 * Create fallback product data when extraction fails
 */
function createFallbackProductData(productName: string, url: string): ProductData {
  const variations = generateProductNameVariations(productName)
  
  return {
    product_name: productName,
    product_name_variations: variations,
    company_name: productName,
    one_line_description: `${productName} product`,
    category: "Business Software", // More specific than just "Software"
    subcategories: [],
    product_type: "software",
    target_audience: {
      who: "businesses",
      company_size: "various",
      industry: "general"
    },
    key_features: [],
    use_cases: [],
    competitors_mentioned: [],
    likely_competitors: [],
    integrations: [],
    pricing_model: "not found",
    geography: {
      country: "Global",
      evidence: "Could not determine specific geography"
    },
    unique_selling_points: [],
    brand_voice: "professional",
    url,
    raw_content_length: 0
  }
}

// Types
export interface ProductData {
  product_name: string
  product_name_variations: string[]
  company_name: string
  one_line_description: string
  category: string
  subcategories: string[]
  product_type: "software" | "physical_product" | "service" | "marketplace" | "content"
  target_audience: {
    who: string
    company_size: string
    industry: string
  }
  key_features: string[]
  use_cases: string[]
  competitors_mentioned: string[]
  likely_competitors: string[]
  integrations: string[]
  pricing_model: string
  geography: {
    country: string
    evidence: string
  }
  unique_selling_points: string[]
  brand_voice: string
  url: string
  raw_content_length: number
}

interface ExtractedProductData {
  product_name: string
  product_name_variations: string[]
  company_name: string
  one_line_description: string
  category: string
  subcategories: string[]
  product_type?: "software" | "physical_product" | "service" | "marketplace" | "content"
  target_audience: {
    who: string
    company_size: string
    industry: string
  }
  key_features: string[]
  use_cases: string[]
  competitors_mentioned: string[]
  likely_competitors?: string[]
  integrations: string[]
  pricing_model: string
  geography: {
    country: string
    evidence: string
  }
  unique_selling_points: string[]
  brand_voice?: string
}
