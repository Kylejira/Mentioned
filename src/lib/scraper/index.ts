import { log } from "@/lib/logger"

const logger = log.create("scraper")

const SCRAPE_TIMEOUT = 8000

export interface ScrapeResult {
  success: boolean
  content: string
  url: string
  error?: string
  method?: "jina" | "direct"
}

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  const startTime = Date.now()

  try {
    const normalizedUrl = normalizeUrl(url)
    logger.info("Starting scrape", { url: normalizedUrl })

    let result = await scrapeWithJina(normalizedUrl)
    if (!result.success || result.content.length < 500) {
      logger.info("Jina failed or insufficient content, trying direct fetch")
      result = await scrapeDirectly(normalizedUrl)
    }

    if (!result.success || result.content.length < 100) {
      logger.warn("Failed to get page content", { url: normalizedUrl })
      return result
    }

    const elapsed = Date.now() - startTime
    logger.info("Scrape complete", { url: normalizedUrl, chars: result.content.length, ms: elapsed })
    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error("Scrape failed", { url, error: errorMessage })
    return { success: false, content: "", error: errorMessage, url }
  }
}

async function scrapeWithJina(url: string): Promise<ScrapeResult> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT)

    const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`
    const headers: Record<string, string> = { Accept: "text/plain" }
    if (process.env.JINA_API_KEY) {
      headers["Authorization"] = `Bearer ${process.env.JINA_API_KEY}`
    }

    const response = await fetch(jinaUrl, { headers, signal: controller.signal })
    clearTimeout(timeout)

    if (!response.ok) throw new Error(`Jina returned ${response.status}`)

    const content = await response.text()
    return { success: true, content: cleanContent(content), url, method: "jina" }
  } catch (error) {
    return { success: false, content: "", error: error instanceof Error ? error.message : String(error), url, method: "jina" }
  }
}

async function scrapeDirectly(url: string): Promise<ScrapeResult> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT)

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MentionedBot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!response.ok) throw new Error(`Direct fetch returned ${response.status}`)

    const html = await response.text()
    return { success: true, content: extractTextFromHtml(html), url, method: "direct" }
  } catch (error) {
    return { success: false, content: "", error: error instanceof Error ? error.message : String(error), url, method: "direct" }
  }
}

function normalizeUrl(url: string): string {
  let normalized = url.trim()
  if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
    normalized = "https://" + normalized
  }
  return normalized.replace(/\/$/, "")
}

function cleanContent(content: string): string {
  return content
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .replace(/cookie[s]? (policy|consent|settings)/gi, "")
    .replace(/privacy policy/gi, "")
    .replace(/terms (of service|and conditions)/gi, "")
    .replace(/©\s*\d{4}/g, "")
    .trim()
    .substring(0, 50000)
}

function extractTextFromHtml(html: string): string {
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")

  const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim() : ""
  const metaDescMatch = text.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
  const metaDesc = metaDescMatch ? metaDescMatch[1].trim() : ""

  const headings: string[] = []
  const headingRegex = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi
  let match
  while ((match = headingRegex.exec(text)) !== null) {
    const heading = match[1].replace(/<[^>]+>/g, "").trim()
    if (heading) headings.push(heading)
  }

  const paragraphs: string[] = []
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi
  while ((match = pRegex.exec(text)) !== null) {
    const para = match[1].replace(/<[^>]+>/g, "").trim()
    if (para && para.length > 20) paragraphs.push(para)
  }

  const listItems: string[] = []
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi
  while ((match = liRegex.exec(text)) !== null) {
    const item = match[1].replace(/<[^>]+>/g, "").trim()
    if (item && item.length > 10) listItems.push(item)
  }

  const parts: string[] = []
  if (title) parts.push(`# ${title}`)
  if (metaDesc) parts.push(`\n${metaDesc}`)
  if (headings.length > 0) parts.push(`\n## Key Sections\n${headings.slice(0, 20).join("\n")}`)
  if (paragraphs.length > 0) parts.push(`\n## Content\n${paragraphs.slice(0, 30).join("\n\n")}`)
  if (listItems.length > 0) parts.push(`\n## Features/Points\n- ${listItems.slice(0, 20).join("\n- ")}`)

  return cleanContent(parts.join("\n"))
}
