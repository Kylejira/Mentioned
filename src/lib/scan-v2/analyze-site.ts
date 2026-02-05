/**
 * Site Analysis Module
 * Analyzes a website for content, positioning, and authority signals
 * Used to find gaps vs competitors and generate specific recommendations
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
 * Site analysis result structure
 */
export interface SiteAnalysis {
  name: string
  url: string
  
  content: {
    has_comparison_pages: boolean
    comparison_competitors: string[]
    has_use_case_pages: boolean
    use_cases_found: string[]
    has_faq: boolean
    faq_topics: string[]
    has_blog: boolean
    has_pricing_page: boolean
    has_documentation: boolean
  }
  
  positioning: {
    headline: string
    subheadline: string
    category_stated: boolean
    category_mentioned: string | null
    audience_stated: boolean
    audience_mentioned: string | null
    value_prop_clear: boolean
    value_prop_summary: string | null
  }
  
  authority: {
    has_customer_logos: boolean
    logo_count: number
    logo_names: string[]
    has_testimonials: boolean
    testimonial_count: number
    has_case_studies: boolean
    case_study_count: number
    has_review_badges: boolean
    review_platforms: string[]
    has_press_mentions: boolean
    press_outlets: string[]
    has_usage_stats: boolean
    usage_stats: string[]
  }
  
  raw_analysis: string
}

/**
 * Analyze a website for content, positioning, and authority signals
 */
export async function analyzeSite(
  name: string,
  url: string,
  scrapedContent: string
): Promise<SiteAnalysis> {
  const client = getOpenAI()
  
  console.log(`[SiteAnalysis] Analyzing: ${name} (${url})`)
  
  const analysisPrompt = `You are analyzing a website to understand its content strategy, positioning, and authority signals.

WEBSITE: ${name}
URL: ${url}

WEBSITE CONTENT:
"""
${scrapedContent.substring(0, 35000)}
"""

Analyze this website and extract:

1. CONTENT SIGNALS:
- Does it have comparison pages? (e.g., "X vs Y", "X alternatives", "Compare X to...")
- Does it have use-case specific pages? (e.g., "For startups", "For developers", "For marketing teams")
- Does it have an FAQ section?
- Does it have a blog?
- Does it have a pricing page?
- Does it have documentation/help center?

2. POSITIONING SIGNALS:
- What is the main headline on the homepage?
- Is the product category clearly stated? (e.g., "CRM", "Project Management", "Email Marketing")
- Is the target audience clearly stated?
- Is the value proposition clear and specific?

3. AUTHORITY SIGNALS:
- Customer logos: Are there any? How many? Which companies?
- Testimonials: Are there any? How many approximately?
- Case studies: Are there any? How many?
- Review badges: G2, Capterra, TrustRadius, etc.?
- Press mentions: Any "As seen in" or press logos?
- Usage stats: "10,000+ customers", "1M users", etc.?

Return JSON:
{
  "content": {
    "has_comparison_pages": boolean,
    "comparison_competitors": ["list of competitors mentioned in comparisons"],
    "has_use_case_pages": boolean,
    "use_cases_found": ["list of use cases/audiences with dedicated pages"],
    "has_faq": boolean,
    "faq_topics": ["main FAQ topics found"],
    "has_blog": boolean,
    "has_pricing_page": boolean,
    "has_documentation": boolean
  },
  "positioning": {
    "headline": "exact or close headline text",
    "subheadline": "subheadline if present",
    "category_stated": boolean,
    "category_mentioned": "the category if stated, null otherwise",
    "audience_stated": boolean,
    "audience_mentioned": "the audience if stated, null otherwise",
    "value_prop_clear": boolean,
    "value_prop_summary": "summary of value prop if clear, null otherwise"
  },
  "authority": {
    "has_customer_logos": boolean,
    "logo_count": number (estimate),
    "logo_names": ["company names from logos"],
    "has_testimonials": boolean,
    "testimonial_count": number (estimate),
    "has_case_studies": boolean,
    "case_study_count": number (estimate),
    "has_review_badges": boolean,
    "review_platforms": ["G2", "Capterra", etc.],
    "has_press_mentions": boolean,
    "press_outlets": ["outlet names"],
    "has_usage_stats": boolean,
    "usage_stats": ["10,000+ customers", etc.]
  }
}

Be accurate. Only mark something as present if you actually see evidence in the content.
Return ONLY the JSON object.`

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini", // Use mini for speed on analysis
      messages: [{ role: "user", content: analysisPrompt }],
      response_format: { type: "json_object" },
      temperature: 0.2
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error("Empty response from OpenAI")
    }

    const analysis = JSON.parse(content)
    
    console.log(`[SiteAnalysis] Completed for ${name}`)
    console.log(`[SiteAnalysis] - Comparison pages: ${analysis.content.has_comparison_pages}`)
    console.log(`[SiteAnalysis] - FAQ: ${analysis.content.has_faq}`)
    console.log(`[SiteAnalysis] - Customer logos: ${analysis.authority.logo_count}`)
    console.log(`[SiteAnalysis] - Testimonials: ${analysis.authority.has_testimonials}`)
    
    return {
      name,
      url,
      content: analysis.content,
      positioning: analysis.positioning,
      authority: analysis.authority,
      raw_analysis: content
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[SiteAnalysis] Failed for ${name}: ${errorMessage}`)
    
    // Return empty analysis on failure
    return createEmptySiteAnalysis(name, url)
  }
}

/**
 * Create empty site analysis (fallback)
 */
function createEmptySiteAnalysis(name: string, url: string): SiteAnalysis {
  return {
    name,
    url,
    content: {
      has_comparison_pages: false,
      comparison_competitors: [],
      has_use_case_pages: false,
      use_cases_found: [],
      has_faq: false,
      faq_topics: [],
      has_blog: false,
      has_pricing_page: false,
      has_documentation: false
    },
    positioning: {
      headline: "",
      subheadline: "",
      category_stated: false,
      category_mentioned: null,
      audience_stated: false,
      audience_mentioned: null,
      value_prop_clear: false,
      value_prop_summary: null
    },
    authority: {
      has_customer_logos: false,
      logo_count: 0,
      logo_names: [],
      has_testimonials: false,
      testimonial_count: 0,
      has_case_studies: false,
      case_study_count: 0,
      has_review_badges: false,
      review_platforms: [],
      has_press_mentions: false,
      press_outlets: [],
      has_usage_stats: false,
      usage_stats: []
    },
    raw_analysis: ""
  }
}

/**
 * Gap between user and competitors
 */
export interface VisibilityGap {
  category: "content" | "positioning" | "authority"
  type: string
  impact: "high" | "medium" | "low"
  description: string
  competitor_reference: string | null
  user_status: string
  competitor_status: string
}

/**
 * Find gaps between user's site and competitors
 */
export function findGaps(
  userAnalysis: SiteAnalysis,
  competitorAnalyses: SiteAnalysis[]
): VisibilityGap[] {
  const gaps: VisibilityGap[] = []
  
  if (competitorAnalyses.length === 0) {
    // No competitors to compare - return generic gaps based on missing elements
    return findGenericGaps(userAnalysis)
  }
  
  // === CONTENT GAPS ===
  
  // Comparison pages
  const competitorsWithComparisons = competitorAnalyses.filter(c => c.content.has_comparison_pages)
  if (competitorsWithComparisons.length > 0 && !userAnalysis.content.has_comparison_pages) {
    gaps.push({
      category: "content",
      type: "missing_comparison_pages",
      impact: "high",
      description: "Your site doesn't have comparison pages, but competitors do. AI often references comparison content when recommending tools.",
      competitor_reference: `${competitorsWithComparisons.map(c => c.name).join(" and ")} have comparison pages`,
      user_status: "No comparison pages found",
      competitor_status: `${competitorsWithComparisons.length} competitor(s) have comparison pages`
    })
  }
  
  // Use-case pages
  const competitorsWithUseCases = competitorAnalyses.filter(c => c.content.has_use_case_pages)
  if (competitorsWithUseCases.length > 0 && !userAnalysis.content.has_use_case_pages) {
    const exampleUseCases = competitorsWithUseCases[0]?.content.use_cases_found.slice(0, 3).join(", ")
    gaps.push({
      category: "content",
      type: "missing_use_case_pages",
      impact: "high",
      description: "Competitors have dedicated pages for specific use cases, helping AI understand when to recommend them.",
      competitor_reference: exampleUseCases ? `Example use cases: ${exampleUseCases}` : null,
      user_status: "No use-case specific pages found",
      competitor_status: `${competitorsWithUseCases.length} competitor(s) have use-case pages`
    })
  }
  
  // FAQ
  const competitorsWithFAQ = competitorAnalyses.filter(c => c.content.has_faq)
  if (competitorsWithFAQ.length > 1 && !userAnalysis.content.has_faq) {
    gaps.push({
      category: "content",
      type: "missing_faq",
      impact: "medium",
      description: "FAQ content helps AI answer specific questions about your product. Most competitors have this.",
      competitor_reference: `${competitorsWithFAQ.length} competitors have FAQ sections`,
      user_status: "No FAQ section found",
      competitor_status: "FAQ present on competitor sites"
    })
  }
  
  // === POSITIONING GAPS ===
  
  // Category clarity
  const competitorsWithCategory = competitorAnalyses.filter(c => c.positioning.category_stated)
  if (competitorsWithCategory.length > 0 && !userAnalysis.positioning.category_stated) {
    const example = competitorsWithCategory[0]
    gaps.push({
      category: "positioning",
      type: "unclear_category",
      impact: "high",
      description: "Your homepage doesn't clearly state what category of product you are. AI needs this to know when to recommend you.",
      competitor_reference: example ? `${example.name} clearly states: "${example.positioning.category_mentioned}"` : null,
      user_status: `Your headline: "${userAnalysis.positioning.headline}"`,
      competitor_status: "Competitors clearly state their category"
    })
  }
  
  // Audience clarity
  const competitorsWithAudience = competitorAnalyses.filter(c => c.positioning.audience_stated)
  if (competitorsWithAudience.length > 0 && !userAnalysis.positioning.audience_stated) {
    const example = competitorsWithAudience[0]
    gaps.push({
      category: "positioning",
      type: "unclear_audience",
      impact: "medium",
      description: "Your site doesn't clearly state who the product is for. This helps AI match you to the right queries.",
      competitor_reference: example ? `${example.name} targets: "${example.positioning.audience_mentioned}"` : null,
      user_status: "Target audience not clearly stated",
      competitor_status: "Competitors specify their target audience"
    })
  }
  
  // === AUTHORITY GAPS ===
  
  // Customer logos
  const avgLogos = competitorAnalyses.reduce((sum, c) => sum + c.authority.logo_count, 0) / competitorAnalyses.length
  if (userAnalysis.authority.logo_count < avgLogos * 0.5 && avgLogos > 3) {
    const topCompetitor = competitorAnalyses.reduce((a, b) => 
      a.authority.logo_count > b.authority.logo_count ? a : b
    )
    gaps.push({
      category: "authority",
      type: "missing_customer_logos",
      impact: "medium",
      description: "Customer logos build trust and show AI that real companies use your product.",
      competitor_reference: topCompetitor ? `${topCompetitor.name} shows ${topCompetitor.authority.logo_count}+ logos` : null,
      user_status: userAnalysis.authority.logo_count > 0 ? `${userAnalysis.authority.logo_count} logos` : "No customer logos found",
      competitor_status: `Competitors show avg ${Math.round(avgLogos)} logos`
    })
  }
  
  // Testimonials
  const competitorsWithTestimonials = competitorAnalyses.filter(c => c.authority.has_testimonials)
  if (competitorsWithTestimonials.length > 1 && !userAnalysis.authority.has_testimonials) {
    gaps.push({
      category: "authority",
      type: "missing_testimonials",
      impact: "medium",
      description: "Testimonials provide social proof that AI can reference when recommending products.",
      competitor_reference: `${competitorsWithTestimonials.length} competitors have testimonials`,
      user_status: "No testimonials found",
      competitor_status: "Testimonials present on competitor sites"
    })
  }
  
  // Review badges
  const competitorsWithReviews = competitorAnalyses.filter(c => c.authority.has_review_badges)
  if (competitorsWithReviews.length > 0 && !userAnalysis.authority.has_review_badges) {
    const platforms = competitorsWithReviews.flatMap(c => c.authority.review_platforms)
    const uniquePlatforms = [...new Set(platforms)].slice(0, 3)
    gaps.push({
      category: "authority",
      type: "missing_review_badges",
      impact: "high",
      description: "Review scores from G2, Capterra, etc. are heavily weighted by AI when making recommendations.",
      competitor_reference: uniquePlatforms.length > 0 ? `Competitors show badges from: ${uniquePlatforms.join(", ")}` : null,
      user_status: "No review badges found",
      competitor_status: `${competitorsWithReviews.length} competitors display review badges`
    })
  }
  
  // Case studies
  const competitorsWithCaseStudies = competitorAnalyses.filter(c => c.authority.has_case_studies)
  if (competitorsWithCaseStudies.length > 0 && !userAnalysis.authority.has_case_studies) {
    gaps.push({
      category: "authority",
      type: "missing_case_studies",
      impact: "medium",
      description: "Case studies demonstrate real-world results and help AI understand your product's impact.",
      competitor_reference: `${competitorsWithCaseStudies.length} competitors have case studies`,
      user_status: "No case studies found",
      competitor_status: "Case studies present on competitor sites"
    })
  }
  
  // Sort by impact
  const impactOrder = { high: 0, medium: 1, low: 2 }
  gaps.sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact])
  
  return gaps.slice(0, 6) // Return top 6 gaps
}

/**
 * Find generic gaps when no competitors available
 */
function findGenericGaps(userAnalysis: SiteAnalysis): VisibilityGap[] {
  const gaps: VisibilityGap[] = []
  
  if (!userAnalysis.content.has_comparison_pages) {
    gaps.push({
      category: "content",
      type: "missing_comparison_pages",
      impact: "high",
      description: "Comparison pages help AI understand how you differ from alternatives.",
      competitor_reference: null,
      user_status: "No comparison pages found",
      competitor_status: "Best practice: have comparison pages"
    })
  }
  
  if (!userAnalysis.content.has_faq) {
    gaps.push({
      category: "content",
      type: "missing_faq",
      impact: "medium",
      description: "FAQ content helps AI answer specific questions about your product.",
      competitor_reference: null,
      user_status: "No FAQ section found",
      competitor_status: "Best practice: comprehensive FAQ"
    })
  }
  
  if (!userAnalysis.positioning.category_stated) {
    gaps.push({
      category: "positioning",
      type: "unclear_category",
      impact: "high",
      description: "Your homepage should clearly state what category of product you are.",
      competitor_reference: null,
      user_status: `Current headline: "${userAnalysis.positioning.headline}"`,
      competitor_status: "Best practice: state category clearly"
    })
  }
  
  if (!userAnalysis.authority.has_testimonials) {
    gaps.push({
      category: "authority",
      type: "missing_testimonials",
      impact: "medium",
      description: "Testimonials provide social proof that AI can reference.",
      competitor_reference: null,
      user_status: "No testimonials found",
      competitor_status: "Best practice: display testimonials"
    })
  }
  
  if (!userAnalysis.authority.has_review_badges) {
    gaps.push({
      category: "authority",
      type: "missing_review_badges",
      impact: "high",
      description: "Review scores from G2, Capterra heavily influence AI recommendations.",
      competitor_reference: null,
      user_status: "No review badges found",
      competitor_status: "Best practice: display review scores"
    })
  }
  
  return gaps
}
