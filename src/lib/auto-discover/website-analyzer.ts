import OpenAI from "openai"
import { log } from "@/lib/logger"

const logger = log.create("website-analyzer")

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProductProfile {
  product_name: string
  category: string
  subcategory: string
  problem_solved: string
  target_audience: string
  key_features: string[]
  differentiators: string[]
  competitors: string[]
  keywords: string[]
  pricing_model: string
  tone: string
  extraction_confidence?: "high" | "medium" | "low"
  source_url: string
}

// ---------------------------------------------------------------------------
// OpenAI client (lazy singleton)
// ---------------------------------------------------------------------------

let _openai: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured")
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _openai
}

// ---------------------------------------------------------------------------
// Step 1: Fetch website content
// ---------------------------------------------------------------------------

export async function fetchWebsiteContent(url: string): Promise<string> {
  const normalizedUrl = url.startsWith("http") ? url : `https://${url}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)

  try {
    logger.info("Fetching website", { url: normalizedUrl })

    const response = await fetch(normalizedUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MentionedBot/1.0)",
        Accept: "text/html",
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const html = await response.text()
    const extracted = extractTextFromHtml(html)

    logger.info("Extracted text from website", {
      url: normalizedUrl,
      textLength: extracted.length,
    })

    return extracted
  } finally {
    clearTimeout(timeout)
  }
}

// ---------------------------------------------------------------------------
// Step 2: Extract meaningful text from raw HTML
// ---------------------------------------------------------------------------

export function extractTextFromHtml(html: string): string {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim() : ""

  // Extract meta description
  const descMatch = html.match(
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)/i
  )
  const description = descMatch ? descMatch[1].trim() : ""

  // Extract og:description as fallback
  const ogMatch = html.match(
    /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)/i
  )
  const ogDescription = ogMatch ? ogMatch[1].trim() : ""

  // Remove scripts, styles, nav, footer, header to get body content
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, "")
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")

  // Strip remaining HTML tags
  text = text
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()

  const combined = [
    `Title: ${title}`,
    `Description: ${description || ogDescription}`,
    `Page content: ${text.slice(0, 2500)}`,
  ].join("\n\n")

  return combined
}

// ---------------------------------------------------------------------------
// Step 3: Extract product profile via LLM
// ---------------------------------------------------------------------------

const PROFILE_EXTRACTION_PROMPT = `Analyze this website content and extract a structured product profile. If information is not clearly present, make your best inference based on context clues.

WEBSITE CONTENT:
{WEBSITE_TEXT}

Extract the following and respond ONLY with valid JSON:
{
  "product_name": "The product's name",
  "category": "The product category (e.g., 'AI video generation', 'email marketing')",
  "subcategory": "More specific subcategory if applicable",
  "problem_solved": "One sentence describing the core problem it solves",
  "target_audience": "Who the product is for (e.g., 'developers', 'small businesses')",
  "key_features": ["feature 1", "feature 2", "feature 3"],
  "differentiators": ["what makes it unique 1", "what makes it unique 2"],
  "competitors": ["competitor 1", "competitor 2"],
  "keywords": ["important keyword 1", "keyword 2", "keyword 3"],
  "pricing_model": "free / freemium / paid / enterprise",
  "tone": "How the product positions itself (e.g., 'developer-first', 'simple', 'enterprise')",
  "extraction_confidence": "high / medium / low"
}

RULES:
1. product_name: Extract the actual product name, not the company name (unless they are the same).
2. category: Use specific subcategory terms, not broad ones. 'AI video generation' not 'video tool'. 'Privacy-focused analytics' not 'analytics'.
3. competitors: Only include names explicitly mentioned on the page or that are obvious direct competitors in the same category. Include 3-5 competitors maximum.
4. keywords: Extract terms that a buyer would use when searching for this type of product. Think Reddit/Twitter language, not SEO.
5. If the page is too sparse to extract meaningful info, set "extraction_confidence": "low".`

export async function extractProductProfile(
  websiteText: string,
  sourceUrl: string
): Promise<ProductProfile> {
  const openai = getOpenAI()

  const prompt = PROFILE_EXTRACTION_PROMPT.replace("{WEBSITE_TEXT}", websiteText)

  logger.info("Extracting product profile via LLM", { sourceUrl })

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 1000,
    temperature: 0.3,
  })

  const raw = response.choices[0]?.message?.content || ""

  // Strip markdown code fences if present
  const jsonStr = raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim()

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    logger.error("Failed to parse LLM profile response", { raw })
    throw new Error("Failed to parse product profile from LLM response")
  }

  const profile: ProductProfile = {
    product_name: (parsed.product_name as string) || "Unknown Product",
    category: (parsed.category as string) || "",
    subcategory: (parsed.subcategory as string) || "",
    problem_solved: (parsed.problem_solved as string) || "",
    target_audience: (parsed.target_audience as string) || "",
    key_features: (parsed.key_features as string[]) || [],
    differentiators: (parsed.differentiators as string[]) || [],
    competitors: (parsed.competitors as string[]) || [],
    keywords: (parsed.keywords as string[]) || [],
    pricing_model: (parsed.pricing_model as string) || "",
    tone: (parsed.tone as string) || "",
    extraction_confidence: (parsed.extraction_confidence as "high" | "medium" | "low") || "medium",
    source_url: sourceUrl,
  }

  logger.info("Product profile extracted", {
    product_name: profile.product_name,
    category: profile.category,
    confidence: profile.extraction_confidence,
    competitors: profile.competitors.length,
    keywords: profile.keywords.length,
  })

  return profile
}

// ---------------------------------------------------------------------------
// Full pipeline: URL → ProductProfile
// ---------------------------------------------------------------------------

export async function analyzeWebsite(url: string): Promise<ProductProfile> {
  const websiteText = await fetchWebsiteContent(url)

  if (websiteText.replace(/Title:|Description:|Page content:/g, "").trim().length < 100) {
    logger.warn("Sparse website content detected", { url, textLength: websiteText.length })
    throw new Error("SPARSE_CONTENT")
  }

  return extractProductProfile(websiteText, url)
}
