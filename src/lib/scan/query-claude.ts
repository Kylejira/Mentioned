import Anthropic from "@anthropic-ai/sdk"

// Lazy initialization to avoid errors when API key is not set
let anthropic: Anthropic | null = null

// Track API key validation
let apiKeyValidated = false

function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY environment variable is not set")
    return null
  }
  
  // Log that we have a key (but not the actual key for security) - only once
  if (!apiKeyValidated) {
    console.log(`Anthropic API key configured: ${apiKey.substring(0, 10)}...`)
    apiKeyValidated = true
  }
  
  if (!anthropic) {
    anthropic = new Anthropic({
      apiKey: apiKey,
    })
  }
  return anthropic
}

// Natural system prompt - AI should respond as it would to any user asking for recommendations
const SYSTEM_PROMPT = `You are a helpful assistant. The user is looking for recommendations and advice. Give practical, specific suggestions based on their needs. Mention specific brands, companies, products, or services by name when relevant. Be concise but helpful. Answer questions about any industry - including insurance, healthcare, finance, retail, technology, and more. If you don't have specific knowledge about something, provide general guidance.`

// Timeout for individual queries (in ms) - aggressive for faster scans
const QUERY_TIMEOUT = 15000 // 15 seconds - fail fast

/**
 * Create a promise that rejects after a timeout
 */
function createTimeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Query timed out after ${ms}ms`)), ms)
  })
}

/**
 * Query Claude with a user prompt
 */
export async function queryClaude(query: string): Promise<string> {
  const client = getAnthropicClient()
  
  if (!client) {
    console.error("Failed to initialize Anthropic client - API key missing")
    throw new Error("Anthropic API key not configured")
  }

  return queryWithRetry(async () => {
    const queryStart = Date.now()
    console.log(`[Claude] Querying: "${query.substring(0, 80)}..."`)
    
    try {
      // Race between the API call and a timeout
      const response = await Promise.race([
        client.messages.create({
          model: "claude-3-5-sonnet-20241022", // Using stable Claude 3.5 Sonnet
          max_tokens: 1500,
          temperature: 0.3,
          system: SYSTEM_PROMPT,
          messages: [
            { role: "user", content: query },
          ],
        }),
        createTimeout(QUERY_TIMEOUT)
      ])

      const duration = Date.now() - queryStart
      console.log(`[Claude] Response received in ${duration}ms, content blocks: ${response.content.length}`)
      
      // Extract text from response
      const textBlock = response.content.find(block => block.type === "text")
      const text = textBlock?.type === "text" ? textBlock.text : ""
      
      if (!text) {
        console.error("[Claude] Warning: Response has no text content")
        throw new Error("Claude returned empty response")
      }
      
      return text
    } catch (error: unknown) {
      const duration = Date.now() - queryStart
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[Claude] Query failed after ${duration}ms: ${errorMessage}`)
      throw error
    }
  })
}

/**
 * Query with retry logic for resilience - reduced retries for speed
 */
async function queryWithRetry(
  queryFn: () => Promise<string>,
  maxRetries = 1 // Reduced from 2 to 1 for faster scans
): Promise<string> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await queryFn()
      return result
    } catch (error) {
      lastError = error as Error
      const errorMessage = lastError.message || 'Unknown error'
      console.error(`[Claude] Attempt ${attempt + 1}/${maxRetries + 1} failed: ${errorMessage}`)
      
      // Check if it's a rate limit error - skip retries for rate limits
      const isRateLimit = errorMessage.includes('rate') || errorMessage.includes('429')
      
      // If rate limited, don't retry - just fail fast
      if (isRateLimit) {
        console.log(`[Claude] Rate limited - skipping retries`)
        throw lastError
      }
      
      if (attempt < maxRetries) {
        // Short delay before retry
        const delay = 500 * (attempt + 1) // 500ms, then 1000ms
        console.log(`[Claude] Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError || new Error("Failed to query Claude after retries")
}

/**
 * Check if Anthropic API is configured
 */
export function isAnthropicConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY
}
