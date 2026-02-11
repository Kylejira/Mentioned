/**
 * Query Execution with Caching
 * Runs validated queries on ChatGPT and Claude in parallel
 * Uses caching to ensure consistent results across scans
 */

import OpenAI from "openai"
import Anthropic from "@anthropic-ai/sdk"
import { ValidatedQuery } from "./generate-queries"
import { getCacheKey, getFromCache, setInCache } from "./cache"

// Configuration - OPTIMIZED FOR SPEED AND RELIABILITY
const QUERY_TIMEOUT = 15000 // 15 seconds per query (strict timeout)
const CLAUDE_BATCH_SIZE = 5 // 5 concurrent Claude queries per batch
const CLAUDE_BATCH_DELAY = 300 // 0.3s between batches
const CHATGPT_CONCURRENCY = 10 // 10 concurrent ChatGPT queries
const USE_CACHE = true // Enable/disable caching

// Initialize clients
let openai: OpenAI | null = null
let anthropic: Anthropic | null = null

function getOpenAI(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.error("[OpenAI] OPENAI_API_KEY not found in environment!")
    return null
  }
  
  // Log masked API key for debugging
  const maskedKey = apiKey.substring(0, 8) + "..." + apiKey.substring(apiKey.length - 4)
  console.log(`[OpenAI] Initializing with key: ${maskedKey}`)
  
  if (!openai) {
    try {
      openai = new OpenAI({ apiKey })
      console.log("[OpenAI] Client initialized successfully")
    } catch (initError) {
      console.error("[OpenAI] Failed to initialize client:", initError)
      return null
    }
  }
  return openai
}

function getAnthropic(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error("[Anthropic] ANTHROPIC_API_KEY not found in environment")
    return null
  }
  
  // Log masked API key for debugging
  const maskedKey = apiKey.substring(0, 8) + "..." + apiKey.substring(apiKey.length - 4)
  console.log(`[Anthropic] Initializing with key: ${maskedKey}`)
  
  if (!anthropic) {
    try {
      anthropic = new Anthropic({ apiKey })
      console.log("[Anthropic] Client initialized successfully")
    } catch (initError) {
      console.error("[Anthropic] Failed to initialize client:", initError)
      return null
    }
  }
  return anthropic
}

/**
 * Run all queries on both ChatGPT and Claude
 * Uses Promise.allSettled so one provider failing doesn't kill the scan
 */
export async function runQueries(queries: ValidatedQuery[]): Promise<QueryResult[]> {
  const startTime = Date.now()
  console.log(`[TIMING] RunQueries started - ${queries.length} queries`)
  
  const chatgptClient = getOpenAI()
  const claudeClient = getAnthropic()
  
  const chatgptAvailable = !!chatgptClient
  const claudeAvailable = !!claudeClient
  
  console.log(`[RunQueries] ChatGPT: ${chatgptAvailable ? 'available' : 'not configured'}`)
  console.log(`[RunQueries] Claude: ${claudeAvailable ? 'available' : 'not configured'}`)
  
  if (!claudeAvailable) {
    console.error(`[RunQueries] ANTHROPIC_API_KEY is missing!`)
  }
  
  // Initialize results
  const results: QueryResult[] = queries.map(q => ({
    query: q.query,
    type: q.type,
    chatgpt: { raw_response: null, error: chatgptAvailable ? null : "ChatGPT not configured" },
    claude: { raw_response: null, error: claudeAvailable ? null : "Claude not configured" }
  }))
  
  // RUN CHATGPT AND CLAUDE IN PARALLEL for maximum speed
  // Use Promise.allSettled so one provider failing doesn't stop the other
  console.log(`[TIMING] Starting parallel execution of ChatGPT (${CHATGPT_CONCURRENCY} concurrent) and Claude (batches of ${CLAUDE_BATCH_SIZE})`)
  
  // ChatGPT promise - run with concurrency limiter
  const chatgptPromise = chatgptAvailable 
    ? runChatGPTWithConcurrency(chatgptClient!, queries)
    : Promise.resolve(queries.map(() => ({ raw_response: null, error: "ChatGPT not configured" })))
  
  // Claude promise - batched to avoid rate limits
  const claudePromise = claudeAvailable
    ? runClaudeBatched(claudeClient!, queries)
    : Promise.resolve(queries.map(() => ({ raw_response: null, error: "Claude not configured" })))
  
  // Wait for both to complete - use allSettled so one failing doesn't stop the other
  const parallelStart = Date.now()
  const [chatgptSettled, claudeSettled] = await Promise.allSettled([chatgptPromise, claudePromise])
  console.log(`[TIMING] Parallel execution completed in ${Date.now() - parallelStart}ms`)
  
  // Log which provider was slower
  if (chatgptSettled.status === 'fulfilled' && claudeSettled.status === 'fulfilled') {
    console.log(`[TIMING] Both providers completed successfully`)
  } else {
    if (chatgptSettled.status === 'rejected') console.error(`[TIMING] ChatGPT FAILED:`, chatgptSettled.reason)
    if (claudeSettled.status === 'rejected') console.error(`[TIMING] Claude FAILED:`, claudeSettled.reason)
  }
  
  // Extract results, using empty arrays if a provider completely failed
  const chatgptResults = chatgptSettled.status === 'fulfilled' 
    ? chatgptSettled.value 
    : queries.map(() => ({ raw_response: null, error: "ChatGPT provider failed" }))
  
  const claudeResults = claudeSettled.status === 'fulfilled'
    ? claudeSettled.value
    : queries.map(() => ({ raw_response: null, error: "Claude provider failed" }))
  
  // Merge results
  chatgptResults.forEach((res, i) => { results[i].chatgpt = res })
  claudeResults.forEach((res, i) => { results[i].claude = res })
  
  // Log summary
  const chatgptSuccess = chatgptResults.filter(r => r.raw_response).length
  const claudeSuccess = claudeResults.filter(r => r.raw_response).length
  const duration = Date.now() - startTime
  
  console.log(`[TIMING] RunQueries completed in ${duration}ms`)
  console.log(`[TIMING] Final: ChatGPT ${chatgptSuccess}/${queries.length}, Claude ${claudeSuccess}/${queries.length}`)
  
  // Check if we have ANY results - if both providers completely failed, throw
  if (chatgptSuccess === 0 && claudeSuccess === 0) {
    console.error(`[RunQueries] BOTH providers returned 0 results!`)
    throw new Error("BOTH_PROVIDERS_FAILED")
  }
  
  return results
}

/**
 * Simple concurrency limiter for ChatGPT queries
 */
function createConcurrencyLimiter(concurrency: number) {
  let active = 0
  const queue: Array<{ fn: () => Promise<any>; resolve: (v: any) => void; reject: (e: any) => void }> = []
  
  const next = () => {
    if (active >= concurrency || queue.length === 0) return
    active++
    const { fn, resolve, reject } = queue.shift()!
    fn()
      .then(resolve)
      .catch(reject)
      .finally(() => {
        active--
        next()
      })
  }
  
  return <T>(fn: () => Promise<T>): Promise<T> => {
    return new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject })
      next()
    })
  }
}

/**
 * Run ChatGPT queries with concurrency limit
 */
async function runChatGPTWithConcurrency(
  client: OpenAI,
  queries: ValidatedQuery[]
): Promise<{ raw_response: string | null; error: string | null; fromCache?: boolean }[]> {
  const startTime = Date.now()
  console.log(`[TIMING] ChatGPT starting ${queries.length} queries with concurrency=${CHATGPT_CONCURRENCY}`)
  
  const limit = createConcurrencyLimiter(CHATGPT_CONCURRENCY)
  
  const results = await Promise.allSettled(
    queries.map((q, index) =>
      limit(async () => {
        const queryStart = Date.now()
        try {
          const result = await runChatGPT(client, q.query)
          console.log(`[TIMING] ChatGPT query ${index + 1}/${queries.length} completed in ${Date.now() - queryStart}ms`)
          return result
        } catch (error) {
          console.error(`[ChatGPT] Query ${index + 1} failed in ${Date.now() - queryStart}ms:`, error)
          return { raw_response: null, error: error instanceof Error ? error.message : "Unknown error" }
        }
      })
    )
  )
  
  console.log(`[TIMING] ChatGPT all queries completed in ${Date.now() - startTime}ms`)
  
  return results.map(r => 
    r.status === 'fulfilled' ? r.value : { raw_response: null, error: "Query failed" }
  )
}

/**
 * Run Claude queries in batches (to avoid rate limits) but return all at once
 */
async function runClaudeBatched(
  client: Anthropic,
  queries: ValidatedQuery[]
): Promise<{ raw_response: string | null; error: string | null; fromCache?: boolean }[]> {
  const startTime = Date.now()
  const totalBatches = Math.ceil(queries.length / CLAUDE_BATCH_SIZE)
  console.log(`[TIMING] Claude starting ${queries.length} queries in ${totalBatches} batches (batch_size=${CLAUDE_BATCH_SIZE})`)
  
  const results: { raw_response: string | null; error: string | null; fromCache?: boolean }[] = []
  
  for (let i = 0; i < queries.length; i += CLAUDE_BATCH_SIZE) {
    const batchStart = Date.now()
    const batch = queries.slice(i, i + CLAUDE_BATCH_SIZE)
    const batchNum = Math.floor(i / CLAUDE_BATCH_SIZE) + 1
    
    console.log(`[TIMING] Claude batch ${batchNum}/${totalBatches} starting (${batch.length} queries)`)
    
    const batchResults = await Promise.all(
      batch.map((q, idx) => {
        const queryIndex = i + idx + 1
        return runClaude(client, q.query).then(result => {
          console.log(`[TIMING] Claude query ${queryIndex}/${queries.length} done`)
          return result
        })
      })
    )
    
    results.push(...batchResults)
    console.log(`[TIMING] Claude batch ${batchNum}/${totalBatches} completed in ${Date.now() - batchStart}ms`)
    
    // Small delay between batches
    if (i + CLAUDE_BATCH_SIZE < queries.length) {
      await new Promise(resolve => setTimeout(resolve, CLAUDE_BATCH_DELAY))
    }
  }
  
  console.log(`[TIMING] Claude all queries completed in ${Date.now() - startTime}ms`)
  
  return results
}

/**
 * Run a single query on ChatGPT with timeout and caching
 */
async function runChatGPT(
  client: OpenAI, 
  query: string
): Promise<{ raw_response: string | null; error: string | null; fromCache?: boolean }> {
  // Check cache first
  if (USE_CACHE) {
    const cacheKey = getCacheKey(query, 'chatgpt')
    const cached = getFromCache(cacheKey)
    if (cached) {
      return { raw_response: cached.response, error: null, fromCache: true }
    }
  }
  
  try {
    console.log(`[ChatGPT] Querying: "${query.substring(0, 40)}..."`)
    
    // Use Promise.race for timeout
    // temperature: 0 for CONSISTENT responses across scans
    const response = await Promise.race([
      client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: query }],
        max_tokens: 1500,
        temperature: 0, // Deterministic output for scan consistency
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout after ${QUERY_TIMEOUT/1000}s`)), QUERY_TIMEOUT)
      )
    ])
    
    const content = response.choices[0]?.message?.content
    if (!content) {
      console.warn(`[ChatGPT] Empty response for: "${query.substring(0, 30)}..."`)
      return { raw_response: null, error: "Empty response from ChatGPT" }
    }
    
    // Cache the successful response
    if (USE_CACHE) {
      const cacheKey = getCacheKey(query, 'chatgpt')
      setInCache(cacheKey, content)
    }
    
    console.log(`[ChatGPT] Success: got ${content.length} chars`)
    return { raw_response: content, error: null }
    
  } catch (error: unknown) {
    let errorMessage = "Unknown error"
    let errorCode = ""
    
    if (error instanceof Error) {
      errorMessage = error.message
      const openaiError = error as { status?: number; code?: string }
      if (openaiError.status) errorCode = `Status ${openaiError.status}`
      if (openaiError.code) errorCode = `Code ${openaiError.code}`
    }
    
    const fullError = [errorCode, errorMessage].filter(Boolean).join(" - ")
    console.error(`[ChatGPT] Query failed: ${fullError}`)
    return { raw_response: null, error: fullError }
  }
}

/**
 * Run a single query on Claude with retry logic and caching
 */
async function runClaude(
  client: Anthropic, 
  query: string,
  retryCount: number = 0
): Promise<{ raw_response: string | null; error: string | null; fromCache?: boolean }> {
  const maxRetries = 2 // Two retries for transient errors
  
  // Use Claude 3 Haiku (fastest and most available)
  const CLAUDE_MODEL = "claude-3-haiku-20240307"
  
  // Check cache first (only on first attempt)
  if (USE_CACHE && retryCount === 0) {
    const cacheKey = getCacheKey(query, 'claude')
    const cached = getFromCache(cacheKey)
    if (cached) {
      return { raw_response: cached.response, error: null, fromCache: true }
    }
  }
  
  try {
    console.log(`[Claude] Querying (attempt ${retryCount + 1}): "${query.substring(0, 40)}..."`)
    
    // temperature: 0 for CONSISTENT responses across scans
    const response = await Promise.race([
      client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 1500,
        temperature: 0, // Deterministic output for scan consistency
        messages: [{ role: "user", content: query }]
      }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout after ${QUERY_TIMEOUT/1000}s`)), QUERY_TIMEOUT)
      )
    ])
    
    const textBlock = response.content.find(block => block.type === "text")
    const content = textBlock?.type === "text" ? textBlock.text : null
    
    if (!content) {
      console.warn(`[Claude] Empty response for query: "${query.substring(0, 50)}..."`)
      return { raw_response: null, error: "Empty response from Claude" }
    }
    
    // Cache the successful response
    if (USE_CACHE) {
      const cacheKey = getCacheKey(query, 'claude')
      setInCache(cacheKey, content)
    }
    
    console.log(`[Claude] Success: got ${content.length} chars`)
    return { raw_response: content, error: null }
    
  } catch (error: unknown) {
    // Get detailed error info
    let errorMessage = "Unknown error"
    let errorCode = ""
    let errorType = ""
    
    if (error instanceof Error) {
      errorMessage = error.message
      // Check for Anthropic-specific error properties
      const anthropicError = error as { status?: number; error?: { type?: string } }
      if (anthropicError.status) errorCode = `Status ${anthropicError.status}`
      if (anthropicError.error?.type) errorType = anthropicError.error.type
    } else {
      errorMessage = String(error)
    }
    
    const fullError = [errorCode, errorType, errorMessage].filter(Boolean).join(" - ")
    console.error(`[Claude] Error details: ${fullError}`)
    
    // Check if this is a retryable error
    const isRetryable = 
      errorMessage.includes("429") || 
      errorMessage.includes("rate") ||
      errorMessage.includes("Timeout") ||
      errorMessage.includes("500") ||
      errorMessage.includes("503") ||
      errorMessage.includes("overloaded") ||
      errorMessage.includes("ECONNRESET") ||
      errorMessage.includes("ETIMEDOUT") ||
      errorCode.includes("429") ||
      errorCode.includes("500") ||
      errorCode.includes("503")
    
    if (isRetryable && retryCount < maxRetries) {
      const waitTime = 2000 * (retryCount + 1) // 2s, 4s, 6s
      console.warn(`[Claude] Retrying in ${waitTime}ms (attempt ${retryCount + 2}/${maxRetries + 1})`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
      return runClaude(client, query, retryCount + 1)
    }
    
    console.error(`[Claude] Query failed after ${retryCount + 1} attempts: ${fullError.substring(0, 150)}`)
    return { raw_response: null, error: fullError }
  }
}

// Types
export interface QueryResult {
  query: string
  type: "category" | "problem" | "comparison" | "recommendation"
  chatgpt: {
    raw_response: string | null
    error: string | null
  }
  claude: {
    raw_response: string | null
    error: string | null
  }
}
