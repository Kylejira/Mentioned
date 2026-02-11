/**
 * Visibility Score Calculation
 * Simple, transparent scoring based on actual mentions
 */

import { AnalyzedResult, CompetitorMention } from "./detect-mentions"
import { ProductData } from "./extract-product"
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
 * Calculate visibility score from analyzed results
 */
export function calculateVisibilityScore(analyzedResults: AnalyzedResult[]): VisibilityScore {
  console.log("=== SCORE CALCULATION DEBUG ===")
  console.log("Number of analyzed results:", analyzedResults?.length || 0)
  
  if (!analyzedResults || analyzedResults.length === 0) {
    console.error("[Score] ERROR: No analyzed results to calculate from!")
    return createEmptyScore()
  }
  
  const totalQueries = analyzedResults.length
  
  // Count mentions per platform
  let chatgptMentions = 0
  let claudeMentions = 0
  let chatgptTop3 = 0
  let claudeTop3 = 0
  let totalPositionSum = 0
  let positionCount = 0

  for (const result of analyzedResults) {
    // Debug each result
    const chatgptMentioned = result.chatgpt?.mentioned === true
    const claudeMentioned = result.claude?.mentioned === true
    
    console.log(`Query: "${result.query?.substring(0, 40)}..." | ChatGPT: ${chatgptMentioned} | Claude: ${claudeMentioned}`)
    
    // ChatGPT analysis
    if (chatgptMentioned) {
      chatgptMentions++
      if (result.chatgpt.position !== null) {
        totalPositionSum += result.chatgpt.position
        positionCount++
        if (result.chatgpt.position <= 3) {
          chatgptTop3++
        }
      }
    }
    
    // Claude analysis
    if (claudeMentioned) {
      claudeMentions++
      if (result.claude.position !== null) {
        totalPositionSum += result.claude.position
        positionCount++
        if (result.claude.position <= 3) {
          claudeTop3++
        }
      }
    }
  }
  
  console.log("=== MENTION COUNTS ===")
  console.log(`ChatGPT: ${chatgptMentions}/${totalQueries}`)
  console.log(`Claude: ${claudeMentions}/${totalQueries}`)

  // Calculate totals
  const totalPossible = totalQueries * 2 // ChatGPT + Claude for each query
  const totalMentions = chatgptMentions + claudeMentions
  const totalTop3 = chatgptTop3 + claudeTop3
  const averagePosition = positionCount > 0 ? totalPositionSum / positionCount : null

  // Calculate percentage scores
  const mentionRate = totalPossible > 0 ? (totalMentions / totalPossible) * 100 : 0
  const top3Rate = totalPossible > 0 ? (totalTop3 / totalPossible) * 100 : 0

  // Determine status based on mention rate
  let status: "high" | "medium" | "low" | "not_found"
  if (mentionRate >= 50) {
    status = "high"
  } else if (mentionRate >= 25) {
    status = "medium"
  } else if (mentionRate > 0) {
    status = "low"
  } else {
    status = "not_found"
  }

  // Calculate overall visibility score (0-100)
  // SIMPLIFIED: Score = mention rate (primary) with small bonus for top 3 appearances
  // This makes the score intuitive: 100% mentions = ~95-100 score
  const top3Bonus = top3Rate > 0 ? Math.min(10, top3Rate * 0.1) : 0
  
  // Score is primarily the mention rate, with a small top-3 bonus
  const visibilityScore = Math.round(Math.min(100, mentionRate + top3Bonus))

  console.log("=== FINAL SCORE ===")
  console.log(`Total queries: ${totalQueries}`)
  console.log(`Total checks: ${totalPossible} (${totalQueries} queries × 2 models)`)
  console.log(`Total mentions: ${totalMentions}`)
  console.log(`ChatGPT: ${chatgptMentions}/${totalQueries} (${Math.round(chatgptMentions/totalQueries*100)}%)`)
  console.log(`Claude: ${claudeMentions}/${totalQueries} (${Math.round(claudeMentions/totalQueries*100)}%)`)
  console.log(`Mention rate: ${mentionRate.toFixed(1)}%`)
  console.log(`Top 3 rate: ${top3Rate.toFixed(1)}%`)
  console.log(`Top 3 bonus: +${top3Bonus.toFixed(1)}`)
  console.log(`FINAL SCORE: ${visibilityScore}/100`)
  console.log(`Status: ${status}`)
  console.log("===================")

  return {
    status,
    score: Math.min(100, visibilityScore),
    chatgpt: {
      mentioned: chatgptMentions,
      total: totalQueries,
      top3: chatgptTop3,
      percentage: totalQueries > 0 ? Math.round((chatgptMentions / totalQueries) * 100) : 0
    },
    claude: {
      mentioned: claudeMentions,
      total: totalQueries,
      top3: claudeTop3,
      percentage: totalQueries > 0 ? Math.round((claudeMentions / totalQueries) * 100) : 0
    },
    overall: {
      mentioned: totalMentions,
      total: totalPossible,
      top3: totalTop3,
      percentage: Math.round(mentionRate)
    },
    averagePosition: averagePosition ? Number(averagePosition.toFixed(1)) : null
  }
}

/**
 * Create an empty score when no data is available
 */
function createEmptyScore(): VisibilityScore {
  return {
    status: "not_found",
    score: 0,
    chatgpt: { mentioned: 0, total: 0, top3: 0, percentage: 0 },
    claude: { mentioned: 0, total: 0, top3: 0, percentage: 0 },
    overall: { mentioned: 0, total: 0, top3: 0, percentage: 0 },
    averagePosition: null
  }
}

/**
 * Aggregate competitor data from all responses
 * Now includes AI-powered filtering to remove irrelevant competitors
 */
export async function aggregateCompetitors(
  analyzedResults: AnalyzedResult[],
  productData?: ProductData
): Promise<AggregatedCompetitor[]> {
  console.log(`[AggregateCompetitors] Processing ${analyzedResults.length} results`)
  
  const competitorMap = new Map<string, {
    name: string
    mentions: number
    positions: number[]
    platforms: { chatgpt: number; claude: number }
  }>()

  let totalChatGPTCompetitors = 0
  let totalClaudeCompetitors = 0

  for (const result of analyzedResults) {
    // Process ChatGPT competitors
    const chatgptComps = result.chatgpt.competitors || []
    totalChatGPTCompetitors += chatgptComps.length
    
    for (const comp of chatgptComps) {
      const key = comp.name.toLowerCase()
      const existing = competitorMap.get(key) || {
        name: comp.name,
        mentions: 0,
        positions: [],
        platforms: { chatgpt: 0, claude: 0 }
      }
      existing.mentions++
      existing.platforms.chatgpt++
      if (comp.position) existing.positions.push(comp.position)
      competitorMap.set(key, existing)
    }

    // Process Claude competitors
    const claudeComps = result.claude.competitors || []
    totalClaudeCompetitors += claudeComps.length
    
    for (const comp of claudeComps) {
      const key = comp.name.toLowerCase()
      const existing = competitorMap.get(key) || {
        name: comp.name,
        mentions: 0,
        positions: [],
        platforms: { chatgpt: 0, claude: 0 }
      }
      existing.mentions++
      existing.platforms.claude++
      if (comp.position) existing.positions.push(comp.position)
      competitorMap.set(key, existing)
    }
  }
  
  console.log(`[AggregateCompetitors] Found ${totalChatGPTCompetitors} ChatGPT competitors, ${totalClaudeCompetitors} Claude competitors`)
  console.log(`[AggregateCompetitors] Unique competitors: ${competitorMap.size}`)

  // Convert to sorted array
  const totalQueries = analyzedResults.length
  let competitors = Array.from(competitorMap.values())
    .map(comp => ({
      name: comp.name,
      mentions: comp.mentions,
      totalPossible: totalQueries * 2, // Both platforms
      mentionRate: Math.round((comp.mentions / (totalQueries * 2)) * 100),
      averagePosition: comp.positions.length > 0
        ? Number((comp.positions.reduce((a, b) => a + b, 0) / comp.positions.length).toFixed(1))
        : null,
      platforms: comp.platforms
    }))
    .sort((a, b) => b.mentions - a.mentions)

  // Filter irrelevant competitors if we have product data
  if (productData && competitors.length > 0) {
    const allCompetitorNames = competitors.map(c => c.name)
    const relevantNames = await filterRelevantCompetitors(
      allCompetitorNames,
      productData.category,
      productData.one_line_description
    )
    
    // Keep only relevant competitors
    const relevantSet = new Set(relevantNames.map(n => n.toLowerCase()))
    const filteredCount = competitors.length
    competitors = competitors.filter(c => relevantSet.has(c.name.toLowerCase()))
    
    console.log(`[AggregateCompetitors] Filtered: ${filteredCount} → ${competitors.length} relevant competitors`)
  }

  return competitors.slice(0, 15) // Top 15 competitors
}

/**
 * Simple competitor aggregation WITHOUT AI filtering
 * Used when running low on time to avoid additional AI calls
 */
export function aggregateCompetitorsSimple(
  analyzedResults: AnalyzedResult[]
): AggregatedCompetitor[] {
  console.log(`[AggregateCompetitors] SIMPLE mode - no AI filtering`)
  
  const competitorMap = new Map<string, {
    name: string
    mentions: number
    positions: number[]
    platforms: { chatgpt: number; claude: number }
  }>()

  for (const result of analyzedResults) {
    // Process ChatGPT competitors
    const chatgptComps = result.chatgpt.competitors || []
    for (const comp of chatgptComps) {
      const key = comp.name.toLowerCase()
      const existing = competitorMap.get(key) || {
        name: comp.name,
        mentions: 0,
        positions: [],
        platforms: { chatgpt: 0, claude: 0 }
      }
      existing.mentions++
      existing.platforms.chatgpt++
      if (comp.position) existing.positions.push(comp.position)
      competitorMap.set(key, existing)
    }

    // Process Claude competitors
    const claudeComps = result.claude.competitors || []
    for (const comp of claudeComps) {
      const key = comp.name.toLowerCase()
      const existing = competitorMap.get(key) || {
        name: comp.name,
        mentions: 0,
        positions: [],
        platforms: { chatgpt: 0, claude: 0 }
      }
      existing.mentions++
      existing.platforms.claude++
      if (comp.position) existing.positions.push(comp.position)
      competitorMap.set(key, existing)
    }
  }

  // Convert to sorted array
  const totalQueries = analyzedResults.length
  const competitors = Array.from(competitorMap.values())
    .map(comp => ({
      name: comp.name,
      mentions: comp.mentions,
      totalPossible: totalQueries * 2,
      mentionRate: Math.round((comp.mentions / (totalQueries * 2)) * 100),
      averagePosition: comp.positions.length > 0
        ? Number((comp.positions.reduce((a, b) => a + b, 0) / comp.positions.length).toFixed(1))
        : null,
      platforms: comp.platforms
    }))
    .sort((a, b) => b.mentions - a.mentions)

  console.log(`[AggregateCompetitors] Found ${competitors.length} competitors (unfiltered)`)
  return competitors.slice(0, 15)
}

/**
 * Use AI to filter out irrelevant competitors
 * Removes products from different categories (e.g., Git from Scheduling)
 */
async function filterRelevantCompetitors(
  detectedBrands: string[],
  productCategory: string,
  productDescription: string
): Promise<string[]> {
  if (detectedBrands.length === 0) return []
  
  const client = getOpenAI()
  
  const filterPrompt = `You are filtering a list of brands to find ONLY direct competitors.

PRODUCT CATEGORY: "${productCategory}"
PRODUCT DESCRIPTION: "${productDescription}"

BRANDS DETECTED IN AI RESPONSES:
${detectedBrands.map((b, i) => `${i + 1}. ${b}`).join('\n')}

Your task: Filter this list to ONLY include brands that are:
1. Direct competitors in the "${productCategory}" category
2. Products that solve the SAME core problem
3. Products a customer would actually compare when choosing

EXCLUDE brands that are:
- In a completely different category
  - "Git", "GitHub" = version control (not scheduling, not CRM, not project management)
  - "Asana", "Trello", "Jira", "Monday.com" = project management (unless category IS project management)
  - "Todoist", "Things" = task management (different from project management)
  - "Notion" = note-taking/wiki (unless category is knowledge management)
  - "Slack", "Teams" = team communication (not project management)
- Generic productivity/utility tools that aren't direct competitors
- Integration partners or complementary tools
- Calendar apps when the category is scheduling tools (Google Calendar, Apple Calendar, Outlook are calendars, not scheduling tools)

EXAMPLES:
- For "Scheduling" category: KEEP Calendly, Acuity, SavvyCal, Doodle. EXCLUDE Git, Asana, Trello, Google Calendar.
- For "CRM" category: KEEP Salesforce, HubSpot, Pipedrive. EXCLUDE Asana, Notion, Slack.
- For "Project Management" category: KEEP Asana, Trello, Monday.com, ClickUp. EXCLUDE Calendly, Salesforce.

Return JSON:
{
  "relevant_competitors": ["Brand1", "Brand2"],
  "excluded": [
    { "name": "BrandX", "reason": "Different category - version control" }
  ]
}

Be strict. Only include TRUE competitors.`

  try {
    // 15-second timeout on competitor filtering
    const response = await Promise.race([
      client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: filterPrompt }],
        response_format: { type: "json_object" },
        temperature: 0.1
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Competitor filter timeout after 15s")), 15000)
      )
    ])

    const content = response.choices[0]?.message?.content
    if (!content) {
      console.warn("[FilterCompetitors] Empty response, keeping all")
      return detectedBrands
    }

    const parsed = JSON.parse(content) as { 
      relevant_competitors: string[]
      excluded: { name: string; reason: string }[]
    }
    
    // Log what was excluded
    if (parsed.excluded && parsed.excluded.length > 0) {
      console.log(`[FilterCompetitors] Excluded ${parsed.excluded.length} irrelevant brands:`)
      parsed.excluded.forEach(e => console.log(`  - ${e.name}: ${e.reason}`))
    }
    
    console.log(`[FilterCompetitors] Kept ${parsed.relevant_competitors.length} relevant competitors`)
    return parsed.relevant_competitors || detectedBrands

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[FilterCompetitors] Failed: ${errorMessage}`)
    return detectedBrands // Return unfiltered on error
  }
}

/**
 * Generate action plan based on scan findings
 */
export async function generateActionPlan(
  analyzedResults: AnalyzedResult[],
  visibilityScore: VisibilityScore,
  productData: ProductData,
  competitors: AggregatedCompetitor[]
): Promise<ActionPlan> {
  const startTime = Date.now()
  console.log(`[ActionPlan] Generating action plan`)
  
  const client = getOpenAI()
  
  // Summarize findings for the prompt
  const topCompetitors = competitors.slice(0, 5).map(c => c.name).join(", ")
  const mentionedQueries = analyzedResults
    .filter(r => r.chatgpt.mentioned || r.claude.mentioned)
    .map(r => r.query)
    .slice(0, 3)
  const notMentionedQueries = analyzedResults
    .filter(r => !r.chatgpt.mentioned && !r.claude.mentioned)
    .map(r => r.query)
    .slice(0, 3)
  
  const actionPrompt = `You are an AI visibility expert. Based on the scan results, generate a concise action plan.

PRODUCT: ${productData.product_name}
CATEGORY: ${productData.category}
TARGET AUDIENCE: ${productData.target_audience.who}

SCAN RESULTS:
- Overall visibility score: ${visibilityScore.score}/100 (${visibilityScore.status})
- ChatGPT mentions: ${visibilityScore.chatgpt.mentioned}/${visibilityScore.chatgpt.total} queries (${visibilityScore.chatgpt.percentage}%)
- Claude mentions: ${visibilityScore.claude.mentioned}/${visibilityScore.claude.total} queries (${visibilityScore.claude.percentage}%)
- Average position when mentioned: ${visibilityScore.averagePosition || "N/A"}

TOP COMPETITORS IN AI RESPONSES:
${topCompetitors || "None identified"}

QUERIES WHERE PRODUCT WAS MENTIONED:
${mentionedQueries.length > 0 ? mentionedQueries.join("\n") : "None"}

QUERIES WHERE PRODUCT WAS NOT MENTIONED:
${notMentionedQueries.length > 0 ? notMentionedQueries.join("\n") : "None"}

Generate an action plan with:
1. A brief summary of findings (2-3 sentences)
2. Exactly 3 specific, actionable recommendations to improve AI visibility
3. Each recommendation should be specific to this product, not generic advice

Return JSON:
{
  "summary": "Brief summary of the visibility situation",
  "status_explanation": "Why the product has this visibility level",
  "recommendations": [
    {
      "title": "Short action title (5-7 words)",
      "description": "Specific, actionable description (1-2 sentences)",
      "priority": "high" | "medium" | "low",
      "impact": "What improvement to expect"
    }
  ],
  "key_insight": "One key insight about the product's AI visibility"
}

Return ONLY the JSON object.`

  try {
    // 15-second timeout on action plan generation
    const response = await Promise.race([
      client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: actionPrompt }],
        response_format: { type: "json_object" },
        temperature: 0.5
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Action plan generation timeout after 15s")), 15000)
      )
    ])

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error("Empty response")
    }

    const plan = JSON.parse(content) as ActionPlan
    
    const duration = Date.now() - startTime
    console.log(`[ActionPlan] Generated in ${duration}ms`)
    
    return plan

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[ActionPlan] Failed: ${errorMessage}`)
    
    // Return fallback action plan
    return {
      summary: `${productData.product_name} has ${visibilityScore.status} visibility in AI recommendations.`,
      status_explanation: `The product was mentioned in ${visibilityScore.overall.percentage}% of AI queries tested.`,
      recommendations: [
        {
          title: "Improve online presence and content",
          description: "Create more content that addresses common questions in your category.",
          priority: "high",
          impact: "Increase chances of being indexed by AI models"
        },
        {
          title: "Build authority through reviews",
          description: "Encourage customers to leave reviews on trusted platforms.",
          priority: "medium",
          impact: "Improve trust signals for AI recommendations"
        },
        {
          title: "Optimize for category keywords",
          description: `Ensure your website clearly positions you in the ${productData.category} category.`,
          priority: "medium",
          impact: "Better category association in AI models"
        }
      ],
      key_insight: "AI visibility is influenced by online presence, reviews, and clear positioning."
    }
  }
}

// Types
export interface VisibilityScore {
  status: "high" | "medium" | "low" | "not_found"
  score: number // 0-100
  chatgpt: {
    mentioned: number
    total: number
    top3: number
    percentage: number
  }
  claude: {
    mentioned: number
    total: number
    top3: number
    percentage: number
  }
  overall: {
    mentioned: number
    total: number
    top3: number
    percentage: number
  }
  averagePosition: number | null
}

export interface AggregatedCompetitor {
  name: string
  mentions: number
  totalPossible: number
  mentionRate: number
  averagePosition: number | null
  platforms: {
    chatgpt: number
    claude: number
  }
}

export interface ActionPlan {
  summary: string
  status_explanation: string
  recommendations: {
    title: string
    description: string
    priority: "high" | "medium" | "low"
    impact: string
  }[]
  key_insight: string
}
