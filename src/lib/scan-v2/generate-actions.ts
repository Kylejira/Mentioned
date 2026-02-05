/**
 * Action Plan Generation
 * Generates evidence-based recommendations by comparing user's site to competitors
 */

import OpenAI from "openai"
import { VisibilityGap, SiteAnalysis } from "./analyze-site"
import { ProductData } from "./extract-product"

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
 * Evidence-based action item structure
 */
export interface ActionItem {
  id: string
  number: number
  category: "social_proof" | "content" | "positioning"
  type: string
  title: string
  what_we_found: string        // Quote actual content from user's site
  competitor_comparison: string // What competitors do better
  why_it_matters: string       // How this affects AI visibility
  what_to_do: string          // Exact steps with examples
  effort: "30 mins" | "1-2 hours" | "2-3 hours" | "half day"
  impact: "high" | "medium" | "low"
  generate_type: "comparison_page" | "headline" | "faq" | "testimonial_email" | "use_case_page" | null
}

/**
 * Scan context for action generation
 */
export interface ScanContext {
  score: number
  queriesNotMentioned: string[]
  topCompetitors: Array<{ name: string; mentions: number }>
  totalQueries: number
}

/**
 * Generate evidence-based actions by comparing user's site to competitors
 */
export async function generateActionItems(
  gaps: VisibilityGap[],
  productData: ProductData,
  topCompetitorNames: string[],
  scanContext?: ScanContext,
  userSiteAnalysis?: SiteAnalysis | null,
  competitorAnalyses?: SiteAnalysis[]
): Promise<ActionItem[]> {
  const client = getOpenAI()
  
  console.log(`[ActionGen] Generating evidence-based actions for ${productData.product_name}`)
  
  // Use scan context data
  const queriesNotMentioned = scanContext?.queriesNotMentioned || []
  const competitorData = scanContext?.topCompetitors || topCompetitorNames.map(n => ({ name: n, mentions: 0 }))
  const score = scanContext?.score ?? 50
  
  // If we have real site analysis data, use evidence-based generation
  if (userSiteAnalysis && competitorAnalyses && competitorAnalyses.length > 0) {
    console.log(`[ActionGen] Using real site analysis data`)
    return generateEvidenceBasedActions(
      productData,
      userSiteAnalysis,
      competitorAnalyses,
      queriesNotMentioned,
      score
    )
  }
  
  // Fallback to query-based generation if no site analysis
  console.log(`[ActionGen] No site analysis, using query-based fallback`)
  return createFallbackActions(productData, topCompetitorNames, queriesNotMentioned, score)
}

/**
 * Generate actions based on real scraped site data
 */
async function generateEvidenceBasedActions(
  productData: ProductData,
  userAnalysis: SiteAnalysis,
  competitorAnalyses: SiteAnalysis[],
  queriesNotMentioned: string[],
  score: number
): Promise<ActionItem[]> {
  const client = getOpenAI()
  
  // Find the most visible competitor
  const topCompetitor = competitorAnalyses[0]
  
  // Build detailed comparison data
  const userSummary = {
    name: userAnalysis.name,
    headline: userAnalysis.positioning?.headline || "Not found",
    hasLogos: userAnalysis.authority?.has_customer_logos || false,
    logoCount: userAnalysis.authority?.logo_count || 0,
    logoNames: userAnalysis.authority?.logo_names || [],
    hasTestimonials: userAnalysis.authority?.has_testimonials || false,
    testimonialCount: userAnalysis.authority?.testimonial_count || 0,
    hasFaq: userAnalysis.content?.has_faq || false,
    hasComparisonPages: userAnalysis.content?.has_comparison_pages || false,
    comparisonCompetitors: userAnalysis.content?.comparison_competitors || [],
    categoryStated: userAnalysis.positioning?.category_stated || false,
    categoryMentioned: userAnalysis.positioning?.category_mentioned || null,
    hasUsageStats: userAnalysis.authority?.has_usage_stats || false,
    usageStats: userAnalysis.authority?.usage_stats || [],
    hasReviewBadges: userAnalysis.authority?.has_review_badges || false,
    reviewPlatforms: userAnalysis.authority?.review_platforms || []
  }
  
  const competitorSummary = topCompetitor ? {
    name: topCompetitor.name,
    headline: topCompetitor.positioning?.headline || "Not found",
    hasLogos: topCompetitor.authority?.has_customer_logos || false,
    logoCount: topCompetitor.authority?.logo_count || 0,
    logoNames: topCompetitor.authority?.logo_names?.slice(0, 5) || [],
    hasTestimonials: topCompetitor.authority?.has_testimonials || false,
    testimonialCount: topCompetitor.authority?.testimonial_count || 0,
    hasFaq: topCompetitor.content?.has_faq || false,
    hasComparisonPages: topCompetitor.content?.has_comparison_pages || false,
    comparisonCompetitors: topCompetitor.content?.comparison_competitors || [],
    categoryStated: topCompetitor.positioning?.category_stated || false,
    hasUsageStats: topCompetitor.authority?.has_usage_stats || false,
    usageStats: topCompetitor.authority?.usage_stats || [],
    hasReviewBadges: topCompetitor.authority?.has_review_badges || false,
    reviewPlatforms: topCompetitor.authority?.review_platforms || []
  } : null
  
  const actionPrompt = `You are analyzing a website to provide SPECIFIC improvement recommendations based on REAL data.

USER'S WEBSITE ANALYSIS:
${JSON.stringify(userSummary, null, 2)}

TOP COMPETITOR ANALYSIS (ranks higher in AI recommendations):
${competitorSummary ? JSON.stringify(competitorSummary, null, 2) : "No competitor data available"}

SCAN RESULTS:
- User's visibility score: ${score}%
- Queries user wasn't mentioned in: ${queriesNotMentioned.slice(0, 5).map(q => `"${q}"`).join(", ") || "Not available"}
- Category: ${productData.category}

Generate EXACTLY 3 actions. Each action MUST be based on REAL findings from the data above.

CRITICAL RULES:
1. "what_we_found" — Quote actual content or state specific facts from user's site
2. "competitor_comparison" — Name the competitor and quantify differences (e.g., "They have 12 testimonials, you have 0")
3. "why_it_matters" — Explain how this specifically affects AI recommendations
4. "what_to_do" — Give exact instructions with example text they can copy

DO NOT use generic phrases like:
- "enhance", "leverage", "optimize", "boost"
- "improve visibility", "increase credibility"
- "consider adding", "you should think about"

INSTEAD use specific language like:
- "Add this exact text to your homepage: '[specific text]'"
- "Create a page at yoursite.com/vs/competitor with these sections: ..."
- "Your headline says 'X', change it to 'Y' because..."

Return JSON:
{
  "actions": [
    {
      "category": "social_proof" | "content" | "positioning",
      "title": "Short, specific action title",
      "what_we_found": "Specific finding from user's site with quotes if possible",
      "competitor_comparison": "Specific comparison with numbers and competitor name",
      "why_it_matters": "How this affects AI recommendations specifically",
      "what_to_do": "Exact steps with example text",
      "effort": "30 mins" | "1-2 hours" | "2-3 hours",
      "generate_type": "comparison_page" | "headline" | "faq" | "testimonial_email" | null
    }
  ]
}`

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: actionPrompt }],
      response_format: { type: "json_object" },
      temperature: 0.2
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      console.error("[ActionGen] Empty response")
      return createEvidenceBasedFallback(productData, userSummary, competitorSummary, queriesNotMentioned)
    }

    const parsed = JSON.parse(content)
    const actions = parsed.actions || []
    
    return actions.slice(0, 3).map((action: any, index: number) => ({
      id: `action-${index + 1}`,
      number: index + 1,
      category: action.category || ["social_proof", "content", "positioning"][index],
      type: action.category || ["social_proof", "content", "positioning"][index],
      title: action.title,
      what_we_found: action.what_we_found,
      competitor_comparison: action.competitor_comparison,
      why_it_matters: action.why_it_matters,
      what_to_do: action.what_to_do,
      effort: action.effort || "1-2 hours",
      impact: index === 0 ? "high" : index === 1 ? "high" : "medium",
      generate_type: action.generate_type || null
    }))
    
  } catch (error) {
    console.error(`[ActionGen] Failed:`, error)
    return createEvidenceBasedFallback(productData, userSummary, competitorSummary, queriesNotMentioned)
  }
}

/**
 * Create evidence-based fallback when AI fails but we have site data
 */
function createEvidenceBasedFallback(
  productData: ProductData,
  userSummary: any,
  competitorSummary: any | null,
  queriesNotMentioned: string[]
): ActionItem[] {
  const productName = productData.product_name
  const competitorName = competitorSummary?.name || "competitors"
  const url = productData.url?.replace(/https?:\/\//, '').replace(/\/$/, '') || 'yoursite.com'
  
  const actions: ActionItem[] = []
  
  // Action 1: Social Proof (based on real data)
  const userTestimonials = userSummary.testimonialCount || 0
  const competitorTestimonials = competitorSummary?.testimonialCount || 0
  const userLogos = userSummary.logoCount || 0
  const competitorLogos = competitorSummary?.logoCount || 0
  
  if (userTestimonials < competitorTestimonials || userLogos < competitorLogos) {
    actions.push({
      id: "action-1",
      number: 1,
      category: "social_proof",
      type: "social_proof",
      title: "Add social proof to homepage",
      what_we_found: userTestimonials === 0 && userLogos === 0
        ? `Your homepage has no customer testimonials and no company logos.${userSummary.hasUsageStats ? ` You mention: "${userSummary.usageStats[0]}"` : ""}`
        : `Your homepage has ${userTestimonials} testimonial${userTestimonials !== 1 ? 's' : ''} and ${userLogos} customer logo${userLogos !== 1 ? 's' : ''}.`,
      competitor_comparison: competitorSummary
        ? `${competitorName} has ${competitorTestimonials} testimonials and ${competitorLogos} customer logos${competitorSummary.logoNames.length > 0 ? ` including ${competitorSummary.logoNames.slice(0, 3).join(", ")}` : ""}.${competitorSummary.hasUsageStats ? ` They display: "${competitorSummary.usageStats[0]}"` : ""}`
        : "Top competitors typically display 5-10 customer logos and multiple testimonials.",
      why_it_matters: "AI tools look for authority signals when recommending products. Without social proof, AI has no evidence that real companies trust you.",
      what_to_do: `Add these elements to your homepage:

1. User count above the fold:
   "Join ${Math.floor(Math.random() * 500 + 100)}+ teams using ${productName}"

2. Customer logos section:
   Add 3-5 logos with text: "Trusted by teams at [Company1], [Company2], [Company3]"

3. 2-3 testimonials with this format:
   "${productName} [specific benefit]. [Result achieved]."
   — [Full Name], [Title] at [Company]`,
      effort: "2-3 hours",
      impact: "high",
      generate_type: "testimonial_email"
    })
  }
  
  // Action 2: Content (FAQ or Comparison based on real data)
  const hasFaq = userSummary.hasFaq
  const hasComparisons = userSummary.hasComparisonPages
  
  if (!hasComparisons && competitorSummary) {
    actions.push({
      id: "action-2",
      number: 2,
      category: "content",
      type: "comparison",
      title: `Create ${productName} vs ${competitorName} comparison page`,
      what_we_found: userSummary.comparisonCompetitors.length > 0
        ? `You have comparison pages for: ${userSummary.comparisonCompetitors.join(", ")}. But not for ${competitorName}.`
        : `Your site has no comparison pages. Users searching "${productName} vs ${competitorName}" won't find you.`,
      competitor_comparison: competitorSummary.hasComparisonPages
        ? `${competitorName} has comparison pages for: ${competitorSummary.comparisonCompetitors.slice(0, 3).join(", ") || "their competitors"}.`
        : `${competitorName} ranks higher in AI recommendations despite not having comparison pages.`,
      why_it_matters: `When users ask AI "Is ${productName} or ${competitorName} better?", AI needs comparison content to answer accurately. Without it, AI defaults to the better-known option.`,
      what_to_do: `Create a page at ${url}/vs/${competitorName.toLowerCase().replace(/\s+/g, '-')}:

Structure:
1. H1: "${productName} vs ${competitorName}: Which is Right for You?"
2. Quick comparison table (5-7 key features)
3. Pricing comparison
4. "Choose ${productName} if..." section
5. "Choose ${competitorName} if..." section
6. Fair verdict (builds trust)`,
      effort: "2-3 hours",
      impact: "high",
      generate_type: "comparison_page"
    })
  } else if (!hasFaq) {
    const missedQueries = queriesNotMentioned.slice(0, 3)
    actions.push({
      id: "action-2",
      number: 2,
      category: "content",
      type: "faq",
      title: "Add FAQ section for AI queries",
      what_we_found: "Your site has no FAQ section. AI tools often pull answers directly from FAQ content.",
      competitor_comparison: competitorSummary?.hasFaq
        ? `${competitorName} has an FAQ section covering common questions.`
        : "Most top-ranking sites include comprehensive FAQ sections.",
      why_it_matters: `You weren't mentioned when users asked: ${missedQueries.map(q => `"${q}"`).join(", ") || "common category questions"}. FAQ content gives AI direct answers.`,
      what_to_do: `Add an FAQ page answering:

${missedQueries.length > 0 
  ? missedQueries.map((q, i) => `${i + 1}. "${q}"`).join("\n")
  : `1. "What is ${productName}?"\n2. "How does ${productName} compare to alternatives?"\n3. "Is ${productName} good for [your audience]?"`}

Answer format:
Q: [Question]
A: ${productName} is [direct answer]. [One specific benefit]. [Call to action].`,
      effort: "1-2 hours",
      impact: "high",
      generate_type: "faq"
    })
  }
  
  // Action 3: Positioning (based on real headline data)
  const userHeadline = userSummary.headline || "Not found"
  const competitorHeadline = competitorSummary?.headline || null
  const categoryStated = userSummary.categoryStated
  
  actions.push({
    id: "action-3",
    number: actions.length + 1,
    category: "positioning",
    type: "positioning",
    title: categoryStated ? "Strengthen category positioning" : `Add "${productData.category}" to homepage`,
    what_we_found: `Your current headline: "${userHeadline}"${!categoryStated ? `. This doesn't mention "${productData.category}".` : ""}`,
    competitor_comparison: competitorHeadline
      ? `${competitorName}'s headline: "${competitorHeadline}"${competitorSummary?.categoryStated ? " — clearly states their category." : ""}`
      : `Top competitors clearly state their category in their headline.`,
    why_it_matters: `AI categorizes products based on homepage content. If you don't say you're a "${productData.category}", AI won't recommend you for "${productData.category}" queries.`,
    what_to_do: `Update your homepage:

1. Headline — change from:
   "${userHeadline}"
   
   To something like:
   "${productName}: The ${productData.category} for ${productData.target_audience?.who || '[your audience]'}"

2. Add category to meta description:
   "${productName} is a ${productData.category.toLowerCase()} that helps [audience] [achieve outcome]."

3. First paragraph: Mention "${productData.category}" within the first 50 words.`,
    effort: "30 mins",
    impact: "medium",
    generate_type: "headline"
  })
  
  // Ensure we have 3 actions
  while (actions.length < 3) {
    actions.push(createGenericAction(productData, actions.length + 1))
  }
  
  return actions.slice(0, 3)
}

/**
 * Create generic action as last resort
 */
function createGenericAction(productData: ProductData, number: number): ActionItem {
  return {
    id: `action-${number}`,
    number,
    category: "content",
    type: "content",
    title: `Improve ${productData.product_name} content`,
    what_we_found: "Additional content opportunities identified.",
    competitor_comparison: "Top competitors have more comprehensive content.",
    why_it_matters: "More relevant content helps AI understand and recommend your product.",
    what_to_do: `Review your site for content gaps and add relevant pages.`,
    effort: "1-2 hours",
    impact: "medium",
    generate_type: null
  }
}

/**
 * Create query-based fallback when no site analysis available
 */
function createFallbackActions(
  productData: ProductData,
  topCompetitors: string[],
  queriesNotMentioned: string[],
  score: number
): ActionItem[] {
  const productName = productData.product_name
  const category = productData.category
  const topCompetitor = topCompetitors[0] || "top competitor"
  const url = productData.url?.replace(/https?:\/\//, '').replace(/\/$/, '') || 'yoursite.com'
  
  const missedQueries = queriesNotMentioned.slice(0, 3)
  const queryList = missedQueries.length > 0 
    ? missedQueries.map(q => `• "${q}"`).join("\n")
    : `• "Best ${category} tools"\n• "What is a good ${category}?"\n• "${category} recommendations"`
  
  return [
    {
      id: "action-1",
      number: 1,
      category: "content",
      type: "comparison",
      title: `Create ${productName} vs ${topCompetitor} page`,
      what_we_found: `No comparison page found for "${productName} vs ${topCompetitor}".`,
      competitor_comparison: `${topCompetitor} appears more frequently in AI recommendations than ${productName}.`,
      why_it_matters: `Users asking "Which is better, ${productName} or ${topCompetitor}?" get no content from you to inform AI's answer.`,
      what_to_do: `Create ${url}/vs/${topCompetitor.toLowerCase().replace(/\s+/g, '-')}:

• Feature comparison table
• Pricing breakdown
• "Best for" sections for each
• Honest trade-offs`,
      effort: "2-3 hours",
      impact: "high",
      generate_type: "comparison_page"
    },
    {
      id: "action-2",
      number: 2,
      category: "content",
      type: "faq",
      title: "Add FAQ for missed queries",
      what_we_found: `You weren't mentioned in ${missedQueries.length || "several"} queries users asked AI.`,
      competitor_comparison: "Competitors with FAQ content rank higher for these queries.",
      why_it_matters: "AI pulls FAQ content directly when answering user questions.",
      what_to_do: `Add FAQ answering:

${queryList}

Format: "Q: [Question] A: ${productName} is [direct answer]..."`,
      effort: "1-2 hours",
      impact: "high",
      generate_type: "faq"
    },
    {
      id: "action-3",
      number: 3,
      category: "positioning",
      type: "positioning",
      title: `State "${category}" on homepage`,
      what_we_found: `Category "${category}" may not be clearly stated on your homepage.`,
      competitor_comparison: "Top-ranking competitors clearly state their category in headlines.",
      why_it_matters: `AI needs to know you're a "${category}" to recommend you for those queries.`,
      what_to_do: `Update headline to: "${productName} is the ${category.toLowerCase()} for [audience]"
      
Update meta description to include "${category}" keyword.`,
      effort: "30 mins",
      impact: "medium",
      generate_type: "headline"
    }
  ]
}

/**
 * Generate content for a specific action
 */
export async function generateContent(
  action: ActionItem,
  productData: ProductData,
  topCompetitors: string[],
  generateType: string
): Promise<{ success: boolean; content: string; error?: string }> {
  const client = getOpenAI()
  
  console.log(`[ContentGen] Generating ${generateType} for ${productData.product_name}`)
  
  let prompt: string
  
  switch (generateType) {
    case "comparison_page":
      const competitor = topCompetitors[0] || "Competitor"
      prompt = `Write a comparison page: "${productData.product_name} vs ${competitor}"

PRODUCT INFO:
- Name: ${productData.product_name}
- Category: ${productData.category}
- Description: ${productData.one_line_description}
- Target audience: ${productData.target_audience.who}
- Key features: ${productData.key_features.slice(0, 5).join(", ")}
- Unique selling points: ${productData.unique_selling_points.join(", ")}

Write a comparison page with:
1. H1: "${productData.product_name} vs ${competitor}: Which is Right for You?"
2. Introduction: Why people compare these two (2-3 sentences)
3. Quick comparison table (features, pricing, best for)
4. Detailed comparison sections (3-4 sections)
5. When to choose ${productData.product_name}
6. When to choose ${competitor}
7. Conclusion with balanced recommendation

TONE: Honest and fair, but subtly favor ${productData.product_name}
LENGTH: 800-1000 words
FORMAT: Markdown`
      break
      
    case "headline":
      prompt = `Generate 5 homepage headline options for ${productData.product_name}.

PRODUCT:
- Description: ${productData.one_line_description}
- Category: ${productData.category}
- Target audience: ${productData.target_audience.who}
- Unique value: ${productData.unique_selling_points[0] || ""}

REQUIREMENTS for each headline:
- MUST state the category clearly (e.g., "project management", "CRM", "email marketing")
- Should mention or imply the target audience
- Under 10 words
- Modern tone, not corporate jargon
- Action-oriented when possible

Return as a numbered list:
1. [Headline 1]
2. [Headline 2]
3. [Headline 3]
4. [Headline 4]
5. [Headline 5]

For each, add a brief note on why it works.`
      break
      
    case "faq":
      prompt = `Create a comprehensive FAQ section for ${productData.product_name}.

PRODUCT:
- Name: ${productData.product_name}
- Category: ${productData.category}
- Description: ${productData.one_line_description}
- Target audience: ${productData.target_audience.who}
- Key features: ${productData.key_features.slice(0, 5).join(", ")}
- Pricing model: ${productData.pricing_model}

Generate 10 FAQs covering:
1. What is ${productData.product_name}? (category clarification)
2. Who is ${productData.product_name} for? (audience)
3. How is ${productData.product_name} different from [alternatives]?
4. How much does ${productData.product_name} cost?
5. What features does ${productData.product_name} have?
6-10. Common questions your audience would ask

FORMAT:
## Frequently Asked Questions

### Q: [Question]
[Clear, helpful answer in 2-4 sentences]

### Q: [Next question]
...`
      break
      
    case "testimonial_email":
      prompt = `Write an email requesting a testimonial from a customer of ${productData.product_name}.

PRODUCT:
- Name: ${productData.product_name}
- Category: ${productData.category}
- Target audience: ${productData.target_audience.who}

Write a short, friendly email that:
- Is under 150 words
- Explains why you're reaching out
- Asks for a 2-3 sentence testimonial
- Offers to draft something they can edit
- Includes 3 specific questions to prompt them:
  1. What problem did we solve?
  2. What results have you seen?
  3. Who would you recommend us to?

TONE: Friendly, grateful, not pushy

Subject: [Subject line]

[Email body]`
      break
      
    case "use_case_page":
      const useCase = productData.use_cases[0] || productData.target_audience.who
      prompt = `Write a use-case landing page: "${productData.product_name} for ${useCase}"

PRODUCT:
- Name: ${productData.product_name}
- Category: ${productData.category}
- Description: ${productData.one_line_description}
- Key features: ${productData.key_features.slice(0, 5).join(", ")}

Write a landing page with:
1. H1: "${productData.product_name} for ${useCase}"
2. Subheadline: The specific value proposition for this audience
3. Pain points section: 3-4 problems this audience faces
4. Solution section: How ${productData.product_name} solves each
5. Key features for this use case (3-4 features)
6. Social proof placeholder: [Customer testimonial here]
7. CTA: Clear call to action

LENGTH: 500-700 words
FORMAT: Markdown`
      break
      
    default:
      return {
        success: false,
        content: "",
        error: `Unknown content type: ${generateType}`
      }
  }
  
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 2000
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error("Empty response from OpenAI")
    }
    
    console.log(`[ContentGen] Generated ${content.length} chars of ${generateType}`)
    
    return {
      success: true,
      content
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[ContentGen] Failed: ${errorMessage}`)
    return {
      success: false,
      content: "",
      error: errorMessage
    }
  }
}
