/**
 * Web Scraper - Fetches and extracts content from URLs
 * Uses Jina AI Reader for reliable markdown extraction
 * Now scrapes multiple pages for comprehensive product understanding
 */

// Timeout for scraping requests - OPTIMIZED FOR SPEED
const SCRAPE_TIMEOUT = 8000 // 8 seconds (reduced for speed)
const MAX_ADDITIONAL_PAGES = 0 // Skip additional pages for speed (main page is enough)

// Pages that typically have valuable product information (prioritized by value)
const VALUABLE_PATHS = [
  '/features', '/product', '/about', '/pricing'
]

/**
 * Scrape a URL and return the content as markdown
 * Uses Jina AI Reader for reliable extraction
 * Now also scrapes additional pages for better context
 */
export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  const startTime = Date.now()
  
  try {
    // Normalize URL
    const normalizedUrl = normalizeUrl(url)
    console.log(`[Scraper] Starting multi-page scrape for: ${normalizedUrl}`)
    
    // Try Jina AI Reader first (most reliable)
    let mainResult = await scrapeWithJina(normalizedUrl)
    if (!mainResult.success || mainResult.content.length < 500) {
      console.log(`[Scraper] Jina failed, trying direct fetch...`)
      mainResult = await scrapeDirectly(normalizedUrl)
    }
    
    if (!mainResult.success || mainResult.content.length < 100) {
      console.log(`[Scraper] Failed to get main page content`)
      return mainResult
    }
    
    console.log(`[Scraper] Main page: ${mainResult.content.length} chars`)
    
    // Try to scrape ONE additional page for better product understanding (keep it fast)
    const baseUrl = new URL(normalizedUrl).origin
    const additionalContent: string[] = []
    
    // Try each path sequentially until we get one good result
    for (const path of VALUABLE_PATHS) {
      if (additionalContent.length >= MAX_ADDITIONAL_PAGES) break
      
      try {
        const pageUrl = `${baseUrl}${path}`
        const pageResult = await scrapeWithJina(pageUrl)
        
        if (pageResult.success && pageResult.content.length > 500) {
          console.log(`[Scraper] Got ${path}: ${pageResult.content.length} chars`)
          additionalContent.push(`\n\n--- Content from ${path} page ---\n${pageResult.content.substring(0, 6000)}`)
          break // Got one good page, stop
        }
      } catch {
        // Ignore errors, try next path
      }
    }
    
    // Combine all content
    const combinedContent = mainResult.content + additionalContent.join('')
    const totalTime = Date.now() - startTime
    console.log(`[Scraper] Total: ${combinedContent.length} chars from ${additionalContent.length + 1} pages in ${totalTime}ms`)
    
    return {
      ...mainResult,
      content: combinedContent
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[Scraper] Failed: ${errorMessage}`)
    return {
      success: false,
      content: '',
      error: errorMessage,
      url
    }
  }
}

/**
 * Scrape using Jina AI Reader
 */
async function scrapeWithJina(url: string): Promise<ScrapeResult> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT)
    
    const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`
    
    const headers: Record<string, string> = {
      'Accept': 'text/plain',
    }
    
    // Add API key if available
    if (process.env.JINA_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.JINA_API_KEY}`
    }
    
    const response = await fetch(jinaUrl, {
      headers,
      signal: controller.signal
    })
    
    clearTimeout(timeout)
    
    if (!response.ok) {
      throw new Error(`Jina returned ${response.status}`)
    }
    
    const content = await response.text()
    
    // Clean up the content
    const cleanedContent = cleanContent(content)
    
    return {
      success: true,
      content: cleanedContent,
      url,
      method: 'jina'
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      content: '',
      error: errorMessage,
      url,
      method: 'jina'
    }
  }
}

/**
 * Direct fetch with basic HTML parsing
 */
async function scrapeDirectly(url: string): Promise<ScrapeResult> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT)
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MentionedBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml'
      },
      signal: controller.signal
    })
    
    clearTimeout(timeout)
    
    if (!response.ok) {
      throw new Error(`Direct fetch returned ${response.status}`)
    }
    
    const html = await response.text()
    
    // Extract text content from HTML
    const content = extractTextFromHtml(html)
    
    return {
      success: true,
      content,
      url,
      method: 'direct'
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      content: '',
      error: errorMessage,
      url,
      method: 'direct'
    }
  }
}

/**
 * Normalize URL - ensure it has protocol
 */
function normalizeUrl(url: string): string {
  let normalized = url.trim()
  
  // Add protocol if missing
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'https://' + normalized
  }
  
  // Remove trailing slash
  normalized = normalized.replace(/\/$/, '')
  
  return normalized
}

/**
 * Clean up scraped content
 */
function cleanContent(content: string): string {
  return content
    // Remove excessive whitespace
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    // Remove common navigation/footer text patterns
    .replace(/cookie[s]? (policy|consent|settings)/gi, '')
    .replace(/privacy policy/gi, '')
    .replace(/terms (of service|and conditions)/gi, '')
    .replace(/©\s*\d{4}/g, '')
    // Trim
    .trim()
    // Limit length to avoid token limits
    .substring(0, 50000)
}

/**
 * Extract text content from HTML
 */
function extractTextFromHtml(html: string): string {
  // Remove script and style tags
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
  
  // Extract title
  const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim() : ''
  
  // Extract meta description
  const metaDescMatch = text.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
  const metaDesc = metaDescMatch ? metaDescMatch[1].trim() : ''
  
  // Extract headings
  const headings: string[] = []
  const headingRegex = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi
  let match
  while ((match = headingRegex.exec(text)) !== null) {
    const heading = match[1].replace(/<[^>]+>/g, '').trim()
    if (heading) headings.push(heading)
  }
  
  // Extract paragraph text
  const paragraphs: string[] = []
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi
  while ((match = pRegex.exec(text)) !== null) {
    const para = match[1].replace(/<[^>]+>/g, '').trim()
    if (para && para.length > 20) paragraphs.push(para)
  }
  
  // Extract list items
  const listItems: string[] = []
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi
  while ((match = liRegex.exec(text)) !== null) {
    const item = match[1].replace(/<[^>]+>/g, '').trim()
    if (item && item.length > 10) listItems.push(item)
  }
  
  // Combine into structured content
  const parts: string[] = []
  
  if (title) parts.push(`# ${title}`)
  if (metaDesc) parts.push(`\n${metaDesc}`)
  if (headings.length > 0) parts.push(`\n## Key Sections\n${headings.slice(0, 20).join('\n')}`)
  if (paragraphs.length > 0) parts.push(`\n## Content\n${paragraphs.slice(0, 30).join('\n\n')}`)
  if (listItems.length > 0) parts.push(`\n## Features/Points\n- ${listItems.slice(0, 20).join('\n- ')}`)
  
  return cleanContent(parts.join('\n'))
}

// Types
export interface ScrapeResult {
  success: boolean
  content: string
  url: string
  error?: string
  method?: 'jina' | 'direct'
}
