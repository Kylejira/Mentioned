import { log } from "@/lib/logger"
import type { SaaSProfile } from "../profiler/types"
import type { GeneratedQuery, IntentCluster } from "./types"

const logger = log.create("query-generator")
import type { ScanLimits } from "../config/scan-limits"

interface IntentConfig {
  count: number
  instruction: string
  formFields: string[]
}

const INTENT_CONFIGS: Record<Exclude<IntentCluster, "user_provided">, IntentConfig> = {
  direct_recommendation: {
    count: 15,
    formFields: ["core_problem", "target_buyer", "category"],
    instruction: `Generate queries where the TARGET BUYER asks an AI assistant to recommend a tool for the CORE PROBLEM within the SPECIFIC SUBCATEGORY.

~30% of queries MUST name a specific competitor from the profile (e.g., "something like [competitor] for [niche need]").
~20% of queries MUST reference a specific feature or differentiator from the profile.

GOOD examples (niche-specific):
- "What's the best merchant of record for selling digital courses?"
- "Recommend an AI scheduling tool for remote dev teams that syncs with Slack"
- "Tool like Lemon Squeezy for handling VAT on digital downloads"

BAD examples (too broad — NEVER generate these):
- "Best payment tool"
- "What software should I use for my business?"
- "Recommend a scheduling app"

Each query MUST use subcategory-specific terminology. If the subcategory is "AI video generation for marketing", say THAT — not "video tool" or "marketing software".

Vary across:
- "[target buyer] asking for [subcategory] tool to solve [specific aspect of problem]"
- "Recommend a [subcategory] for [target buyer context + specific need]"
- "Something like [competitor] but with [differentiator-adjacent need]"`,
  },

  alternatives: {
    count: 12,
    formFields: ["competitors_mentioned", "target_buyer"],
    instruction: `Generate queries where the TARGET BUYER looks for alternatives to known competitors, anchored to the SPECIFIC SUBCATEGORY.

~30% of queries MUST name a specific competitor (required for this cluster — use ONLY competitors from the profile, never the target brand).
~20% MUST reference a specific feature or capability gap that motivates the switch.

GOOD examples (niche-specific):
- "Alternatives to Calendly for medical appointment scheduling with HIPAA compliance"
- "Something like Loom but for async code review walkthroughs"
- "Tools like Notion for engineering team knowledge bases with API docs support"

BAD examples (too broad):
- "Alternatives to [competitor]"
- "Tools like [competitor] for business"
- "What can I use instead of [competitor]?"

Vary:
- "What are alternatives to [competitor] for [subcategory-specific buyer need]?"
- "Tools like [competitor] but with [specific differentiator feature]"
- "[competitor] alternative for [buyer segment] that also handles [niche capability]"

The reason for switching MUST be niche-specific, not generic dissatisfaction.`,
  },

  comparison: {
    count: 12,
    formFields: ["competitors_mentioned", "key_differentiators"],
    instruction: `Generate comparison queries between competitors, focused on DIFFERENTIATOR themes within the SPECIFIC SUBCATEGORY.

~30% MUST name two specific competitors from the profile in a head-to-head comparison.
~20% MUST ask about a specific feature or differentiator area.

GOOD examples (niche-specific):
- "Compare Stripe vs Paddle for handling EU VAT on SaaS subscriptions"
- "HubSpot vs Pipedrive for B2B outbound sales pipeline with email sequences"
- "Which AI writing tool is best for long-form SEO blog content?"

BAD examples (too broad):
- "Compare [comp1] vs [comp2]"
- "Which CRM is better?"
- "Best tool for marketing"

Vary:
- "Compare [comp1] vs [comp2] for [specific subcategory workflow]"
- "Which [subcategory] tool is best for [specific differentiator capability]?"
- "Top [subcategory] tools with [niche feature from differentiators]"
- "[comp1] or [comp2] for [target buyer segment] doing [specific use case]?"

Use ONLY competitors from the profile for named comparisons. Every comparison must specify WHAT is being compared (a feature, workflow, or use case).`,
  },

  problem_based: {
    count: 15,
    formFields: ["core_problem", "target_buyer", "use_cases"],
    instruction: `Generate queries where the TARGET BUYER describes the CORE PROBLEM in their own words, using language specific to the SUBCATEGORY and their workflow.

These must sound like a real person struggling with a SPECIFIC problem, NOT someone shopping for a tool category.

~30% MUST mention a competitor they've tried or heard of (e.g., "I tried [competitor] but it doesn't handle [niche need]").
~20% MUST describe a feature-level pain (not just a category-level pain).

GOOD examples (niche-specific, real pain):
- "My team wastes hours every week manually converting Figma designs to React components"
- "I tried Calendly but it can't handle multi-provider medical scheduling with insurance verification"
- "We need to process creator payouts in 40+ countries and Stripe doesn't handle the tax part"

BAD examples (too generic):
- "I need a better scheduling tool"
- "What software helps with payments?"
- "How do I manage my team's projects?"

Vary the problem expression:
- Describe the niche-specific pain without naming the category
- Express frustration with a competitor's limitation in the subcategory
- Ask for help with a specific scenario from USE CASES
- Include context about team size, industry, or workflow from TARGET BUYER
- Reference a specific feature gap they're experiencing`,
  },

  feature_based: {
    count: 10,
    formFields: ["key_differentiators", "core_features", "user_differentiators"],
    instruction: `Generate queries focused on SPECIFIC features from DIFFERENTIATORS and CORE FEATURES, using subcategory-level precision.

~30% MUST name a competitor and ask if it supports a specific feature.
~20% MUST ask about a highly specific capability (not a generic feature like "integrations" or "analytics").

GOOD examples (niche-specific features):
- "Is there an AI video tool that generates marketing clips from long-form webinars automatically?"
- "Does Paddle handle metered billing for API usage with automatic tax calculation?"
- "What scheduling tools support multi-timezone round-robin assignment with Salesforce sync?"

BAD examples (too generic):
- "What tools have good integrations?"
- "Best tool with analytics"
- "Is there a [category] with a mobile app?"

Vary:
- "What [subcategory] tools offer [specific differentiator feature]?"
- "Is there a [subcategory] with [highly specific capability from core features]?"
- "Does [competitor] support [niche feature]? If not, what alternatives do?"
- "Best [subcategory] that handles [technical requirement from differentiators]"

Prioritize differentiator features and niche-specific capabilities over generic features like "reporting", "dashboard", or "API".`,
  },

  budget_based: {
    count: 8,
    formFields: ["target_buyer", "pricing_model"],
    instruction: `Generate pricing/budget queries tailored to the TARGET BUYER and SPECIFIC SUBCATEGORY.

~30% MUST name a competitor and compare pricing (e.g., "cheaper than [competitor] for [niche use case]").
~20% MUST reference a specific feature included at the price point.

GOOD examples (niche-specific pricing):
- "Free merchant of record for indie game developers selling digital downloads"
- "Cheaper alternative to Calendly for healthcare scheduling with HIPAA compliance"
- "Affordable AI video generator under $50/month that handles batch processing"

BAD examples (too generic):
- "Free scheduling tool"
- "Best cheap CRM"
- "Affordable software for startups"

Vary:
- "Free [subcategory] for [specific buyer segment with niche context]"
- "Affordable [subcategory] under $[realistic price] with [specific feature]"
- "Cheaper than [competitor] for [subcategory-specific use case]"
- "[subcategory] with a free tier that includes [specific niche capability]"

Match budget language to the buyer: startups say "free tier", agencies say "per-client pricing", enterprise says "cost-effective at scale".`,
  },
}

export { INTENT_CONFIGS }

export class QueryGenerator {
  constructor(
    private llmCall: (prompt: string) => Promise<string>,
    private limits: ScanLimits
  ) {}

  async generate(profile: SaaSProfile): Promise<GeneratedQuery[]> {
    const allQueries: GeneratedQuery[] = []

    // Inject user-provided buyer questions first (highest signal, bypass generation)
    if (profile.buyer_questions && profile.buyer_questions.length > 0) {
      for (const q of profile.buyer_questions) {
        allQueries.push({
          text: q,
          intent: "user_provided",
          generated_by: "llm" as const,
        })
      }
    }

    const clusterPromises = Object.entries(INTENT_CONFIGS).map(
      async ([intent, config]) => {
        const cappedCount = Math.min(config.count, this.limits.maxQueriesPerCluster)
        return this.generateCluster(
          profile,
          intent as IntentCluster,
          { ...config, count: cappedCount }
        )
      }
    )

    const results = await Promise.allSettled(clusterPromises)
    for (const result of results) {
      if (result.status === "fulfilled") {
        allQueries.push(...result.value)
      } else {
        logger.error("Query cluster generation failed", { error: String(result.reason) })
      }
    }

    const nicheValidated = this.validateNicheSpecificity(allQueries, profile)

    return nicheValidated.slice(0, this.limits.maxQueries)
  }

  private validateNicheSpecificity(queries: GeneratedQuery[], profile: SaaSProfile): GeneratedQuery[] {
    const broadTerms = this.getBroadCategoryTerms(profile)
    const nicheTerms = this.extractNicheTerms(profile)
    const competitors = profile.competitors_mentioned.map(c => c.toLowerCase())

    if (broadTerms.length === 0) {
      logger.info("Niche validation skipped: no broad terms to filter against", {
        total: queries.length,
      })
      return queries
    }

    const accepted: GeneratedQuery[] = []
    const rejected: GeneratedQuery[] = []

    for (const q of queries) {
      // Never reject user-provided queries
      if (q.intent === "user_provided") {
        accepted.push(q)
        continue
      }

      const lower = q.text.toLowerCase()

      const hasBroadTerm = broadTerms.some(term => lower.includes(term))
      const hasNicheTerm = nicheTerms.some(term => lower.includes(term))
      const hasCompetitor = competitors.some(comp => lower.includes(comp))

      if (hasBroadTerm && !hasNicheTerm && !hasCompetitor) {
        rejected.push(q)
      } else {
        accepted.push(q)
      }
    }

    logger.info("Niche validation complete", {
      before: queries.length,
      after: accepted.length,
      rejected: rejected.length,
    })

    if (rejected.length > 0) {
      logger.warn("Rejected broad queries", {
        count: rejected.length,
        samples: rejected.slice(0, 5).map(q => q.text),
      })
    }

    // Safety: if >50% rejected, the filter is too aggressive — fall back to original
    if (rejected.length > queries.length / 2) {
      logger.warn("Niche validation rejected >50% of queries — falling back to unfiltered list", {
        rejected: rejected.length,
        total: queries.length,
      })
      return queries
    }

    return accepted
  }

  private buildNicheAnchoring(profile: SaaSProfile): string {
    const parts: string[] = []

    const nicheTerms = this.extractNicheTerms(profile)
    if (nicheTerms.length > 0) {
      parts.push(`Niche-specific terms that MUST appear in queries: ${nicheTerms.join(", ")}`)
    }

    if (profile.key_differentiators && profile.key_differentiators.length > 0) {
      parts.push(`Key differentiators: ${profile.key_differentiators.join("; ")}`)
    }
    if (profile.core_problem) {
      parts.push(`Problem solved: ${profile.core_problem}`)
    }
    if (profile.use_cases && profile.use_cases.length > 0) {
      parts.push(`Specific use cases: ${profile.use_cases.join("; ")}`)
    }
    if (profile.target_buyer) {
      parts.push(`Target buyer: ${profile.target_buyer}`)
    }

    const broadTerms = this.getBroadCategoryTerms(profile)
    if (broadTerms.length > 0) {
      parts.push(`AVOID these overly broad terms (too generic): ${broadTerms.join(", ")}`)
    }

    if (parts.length === 0) {
      return `Focus queries on "${profile.subcategory || profile.category}" specifically.`
    }

    return parts.join("\n")
  }

  private extractNicheTerms(profile: SaaSProfile): string[] {
    const sources: string[] = []

    if (profile.subcategory) sources.push(profile.subcategory)
    if (profile.core_problem) sources.push(profile.core_problem)
    if (profile.core_features) sources.push(...profile.core_features)
    if (profile.key_differentiators) sources.push(...profile.key_differentiators)
    if (profile.use_cases) sources.push(...profile.use_cases)

    const combined = sources.join(" ")

    // Extract multi-word technical phrases (2-4 word noun phrases)
    const phrasePattern = /\b([a-z][\w-]+(?: [\w-]+){1,3})\b/gi
    const matches = combined.match(phrasePattern) || []

    // Filter: keep phrases that look technical/specific, drop generic filler
    const stopPhrases = new Set([
      "the best", "a tool", "the tool", "our product", "your product",
      "the platform", "a platform", "the software", "a software",
      "and more", "as well", "such as", "in order", "to help",
      "that can", "which can", "we offer", "you can", "it can",
    ])

    const seen = new Set<string>()
    const terms: string[] = []

    for (const match of matches) {
      const normalized = match.toLowerCase().trim()
      if (normalized.length < 5) continue
      if (stopPhrases.has(normalized)) continue
      if (seen.has(normalized)) continue
      // Must contain at least one letter (not purely numeric)
      if (!/[a-z]/i.test(normalized)) continue

      seen.add(normalized)
      terms.push(normalized)
    }

    return terms.slice(0, 8)
  }

  private getBroadCategoryTerms(profile: SaaSProfile): string[] {
    const BROAD_MAPPINGS: Record<string, string[]> = {
      "ai video generation": ["video editing", "video tool", "video software", "video editor"],
      "ai writing": ["writing tool", "text editor", "document editor"],
      "ai image generation": ["image editing", "photo editor", "design tool", "graphic design"],
      "merchant of record": ["payment processing", "ecommerce platform", "online store"],
      "email marketing": ["marketing tool", "marketing software", "marketing platform"],
      "project management": ["productivity tool", "business software", "collaboration tool"],
      "scheduling": ["calendar app", "productivity tool", "time management"],
      "crm": ["business software", "sales tool", "customer management"],
      "landing page builder": ["website builder", "web design", "cms"],
      "invoicing": ["accounting software", "finance tool", "business software"],
      "help desk": ["customer support", "support tool", "ticketing system"],
      "social media management": ["marketing tool", "social media tool", "content tool"],
      "seo": ["marketing tool", "analytics tool", "website tool"],
      "data analytics": ["business intelligence", "analytics tool", "reporting tool"],
      "code review": ["developer tool", "software tool", "programming tool"],
      "design system": ["design tool", "ui tool", "prototyping tool"],
      "api monitoring": ["monitoring tool", "devops tool", "infrastructure tool"],
      "form builder": ["website builder", "survey tool", "data collection"],
      "video conferencing": ["communication tool", "meeting tool", "collaboration software"],
      "cloud storage": ["file management", "storage tool", "backup tool"],
    }

    const niche = (profile.subcategory || profile.category).toLowerCase()
    const broadTerms = new Set<string>()

    // Direct match
    if (BROAD_MAPPINGS[niche]) {
      for (const term of BROAD_MAPPINGS[niche]) broadTerms.add(term)
    }

    // Partial match: if the niche contains a mapped key or vice versa
    for (const [key, terms] of Object.entries(BROAD_MAPPINGS)) {
      if (niche.includes(key) || key.includes(niche)) {
        for (const term of terms) broadTerms.add(term)
      }
    }

    // Always add the raw parent category as a broad term if it differs from subcategory
    if (profile.subcategory && profile.category.toLowerCase() !== profile.subcategory.toLowerCase()) {
      broadTerms.add(profile.category.toLowerCase())
    }

    return [...broadTerms]
  }

  private async generateCluster(
    profile: SaaSProfile,
    intent: IntentCluster,
    config: IntentConfig
  ): Promise<GeneratedQuery[]> {
    const contextParts: string[] = [
      `Category: ${profile.category}`,
    ]
    if (profile.subcategory) {
      contextParts.push(`Specific niche: ${profile.subcategory}`)
    }
    if (profile.tagline) {
      contextParts.push(`Product description: ${profile.tagline}`)
    }

    if (profile.core_problem) {
      contextParts.push(`CORE PROBLEM: ${profile.core_problem}`)
    }
    if (profile.target_buyer) {
      contextParts.push(`TARGET BUYER: ${profile.target_buyer}`)
    }
    if (config.formFields.includes("key_differentiators") || config.formFields.includes("user_differentiators")) {
      const diffs = [...(profile.key_differentiators || [])]
      if (profile.user_differentiators) {
        diffs.unshift(profile.user_differentiators)
      }
      if (diffs.length > 0) {
        contextParts.push(`DIFFERENTIATORS: ${diffs.join("; ")}`)
      }
    }
    if (config.formFields.includes("core_features") && profile.core_features.length > 0) {
      contextParts.push(`Core features: ${profile.core_features.join(", ")}`)
    }
    if (profile.competitors_mentioned.length > 0) {
      contextParts.push(`Known competitors: ${profile.competitors_mentioned.join(", ")}`)
    }
    if (profile.use_cases && profile.use_cases.length > 0) {
      contextParts.push(`Use cases: ${profile.use_cases.join(", ")}`)
    }
    if (config.formFields.includes("pricing_model") && profile.pricing_model) {
      contextParts.push(`Pricing model: ${profile.pricing_model}`)
    }
    if (config.formFields.includes("category")) {
      contextParts.push(`Target audience: ${profile.target_audience || profile.target_buyer}`)
    }

    const nicheAnchoring = this.buildNicheAnchoring(profile)

    const prompt = `You are generating realistic search queries that a real user might ask an AI assistant (ChatGPT, Claude, Perplexity).

PRODUCT CONTEXT:
${contextParts.join("\n")}

NICHE ANCHORING — THIS IS THE MOST IMPORTANT SECTION:
This product operates in a SPECIFIC subcategory: "${profile.subcategory || profile.category}".
Do NOT generate queries for the broad parent category.

${nicheAnchoring}

Every query MUST be specific enough that an AI assistant would respond with tools in this exact subcategory, NOT the broader category.

If a query could be answered by generic tools from the parent category instead of tools in this niche, it is TOO BROAD and must be rewritten.

INTENT TYPE: ${intent}
${config.instruction}

CRITICAL RULES:
1. NEVER include the brand name "${profile.brand_name}" or any of these aliases in any query: ${profile.brand_aliases.join(", ")}
2. Queries must sound like natural human questions to an AI assistant
3. Vary the phrasing — don't start every query the same way
4. Each query should be 5-20 words
5. Reference specific details from the PRODUCT CONTEXT above — do NOT write generic queries
6. Be SPECIFIC to the product's niche. If the product is a "merchant of record for digital products", ask about THAT — not about generic "payment processing" or "ecommerce" which is too broad.
7. Use the SPECIFIC NICHE and USE CASES to ground queries in the exact problem space this product serves.
8. Queries must sound like a BUYER asking for product recommendations, NOT a developer asking how to build something.

   BAD:  "I need a simple interface for AI-powered video generation"
   GOOD: "What is the best AI video generation tool with a simple interface?"

   BAD:  "Looking for a platform for text-to-video generation"
   GOOD: "What are the top-rated AI text-to-video tools right now?"

   Every query should be phrased so an AI assistant responds with a LIST OF PRODUCT RECOMMENDATIONS, not a tutorial or how-to guide.

   Use patterns like:
   - "What is the best..."
   - "What are the top..."
   - "Which tool should I use for..."
   - "Can you recommend a..."
   - "What do you recommend for..."
   - "What are alternatives to [Competitor] for..."

Generate exactly ${config.count} queries. Return ONLY a JSON array of strings:
["query 1", "query 2", ...]`

    const raw = await this.llmCall(prompt)
    const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim()

    try {
      const queries: string[] = JSON.parse(cleaned)
      return queries.map((text) => ({
        text: text.trim(),
        intent,
        generated_by: "llm" as const,
      }))
    } catch {
      logger.error("Failed to parse queries", { intent, raw_preview: cleaned.slice(0, 200) })
      return []
    }
  }
}
