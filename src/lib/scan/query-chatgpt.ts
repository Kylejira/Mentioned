import OpenAI from "openai"

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

// Natural system prompt - AI should respond as it would to any user asking for recommendations
const SYSTEM_PROMPT = `You are a helpful assistant. The user is looking for recommendations and advice. Give practical, specific suggestions based on their needs. Mention specific brands, companies, products, or services by name when relevant. Be concise but helpful. Answer questions about any industry - including insurance, healthcare, finance, retail, technology, and more. If you don't have specific knowledge about something, provide general guidance.`

// Timeout for individual queries
const QUERY_TIMEOUT = 15000 // 15 seconds

/**
 * Create a timeout promise
 */
function createTimeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Query timed out after ${ms}ms`)), ms)
  })
}

/**
 * Query ChatGPT with a user prompt
 */
export async function queryChatGPT(query: string): Promise<string> {
  const client = getOpenAIClient()
  
  if (!client) {
    throw new Error("OpenAI API key not configured")
  }

  return queryWithRetry(async () => {
    const queryStart = Date.now()
    console.log(`[ChatGPT] Querying: "${query.substring(0, 60)}..."`)
    
    try {
      // Race between API call and timeout
      const response = await Promise.race([
        client.chat.completions.create({
          model: "gpt-4o-mini", // Cost-efficient model
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: query },
          ],
          max_tokens: 1500,
          temperature: 0.3, // Low temperature for more consistent, reproducible results
        }),
        createTimeout(QUERY_TIMEOUT)
      ])
      
      const duration = Date.now() - queryStart
      console.log(`[ChatGPT] Response received in ${duration}ms`)
      
      return response.choices[0]?.message?.content || ""
    } catch (error) {
      const duration = Date.now() - queryStart
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[ChatGPT] Query failed after ${duration}ms: ${errorMessage}`)
      throw error
    }
  })
}

/**
 * Query with retry logic for resilience - reduced retries for speed
 */
async function queryWithRetry(
  queryFn: () => Promise<string>,
  maxRetries = 1 // Reduced from 2 for faster scans
): Promise<string> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await queryFn()
    } catch (error) {
      lastError = error as Error
      const errorMessage = lastError.message || 'Unknown error'
      console.error(`[ChatGPT] Attempt ${attempt + 1}/${maxRetries + 1} failed: ${errorMessage}`)
      
      // Check if it's a rate limit - skip retries
      const isRateLimit = errorMessage.includes('rate') || errorMessage.includes('429')
      if (isRateLimit) {
        console.log(`[ChatGPT] Rate limited - skipping retries`)
        throw lastError
      }
      
      if (attempt < maxRetries) {
        // Short delay before retry
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
  }
  
  throw lastError || new Error("Failed to query ChatGPT")
}

/**
 * Check if OpenAI API is configured
 */
export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY
}
