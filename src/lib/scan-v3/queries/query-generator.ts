import type { SaaSProfile } from "../profiler/types"
import type { GeneratedQuery, IntentCluster } from "./types"
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
    instruction: `Generate queries where a user matching the TARGET BUYER profile asks an AI assistant to recommend a tool for the CORE PROBLEM.

Vary the queries across these patterns:
- "[target buyer role] asking for tool to solve [problem]"
- "Recommend a [category] for [target buyer context]"
- "What's the best [category] for [specific aspect of problem]"

Each query MUST reference either the target buyer context OR the core problem. Generic queries like "best [category] tool" are NOT acceptable.`,
  },

  alternatives: {
    count: 12,
    formFields: ["competitors_mentioned", "target_buyer"],
    instruction: `Generate queries where the TARGET BUYER looks for alternatives to known competitors.

Vary:
- "What are alternatives to [competitor] for [buyer context]?"
- "Tools like [competitor] but [differentiator-adjacent need]"
- "[competitor] alternative for [specific buyer segment]"

Use ONLY competitors from the profile. Never the target brand.`,
  },

  comparison: {
    count: 12,
    formFields: ["competitors_mentioned", "key_differentiators"],
    instruction: `Generate queries comparing tools in this category, especially around differentiator themes.

Vary:
- "Compare [comp1] vs [comp2] for [differentiator area]"
- "Which [category] tool is best for [specific differentiator]?"
- "Top [category] tools with [feature from differentiators]"

Use ONLY competitors from the profile for named comparisons.`,
  },

  problem_based: {
    count: 15,
    formFields: ["core_problem", "target_buyer", "use_cases"],
    instruction: `Generate queries where the TARGET BUYER describes the CORE PROBLEM in their own words, as if talking to an AI assistant.

CRITICAL: These must sound like a real person struggling with the problem, NOT someone shopping for a tool category.

Good: "My team spends 3 hours every Monday just figuring out who's available when"
Bad:  "What scheduling software should I use?"

Vary the problem expression:
- Describe the pain without naming the category
- Express frustration with current manual process
- Ask for help solving a specific scenario from USE CASES
- Include context about team size, industry, or workflow from TARGET BUYER`,
  },

  feature_based: {
    count: 10,
    formFields: ["key_differentiators", "core_features", "user_differentiators"],
    instruction: `Generate queries focused on specific features, especially DIFFERENTIATORS.

Each query should ask about a capability that maps to one of the product's unique selling points.

Vary:
- "What [category] tools offer [differentiator feature]?"
- "Is there a [category] with [specific capability]?"
- "Best [category] that integrates with [relevant tool/workflow]"

Prioritize differentiator features over generic features.`,
  },

  budget_based: {
    count: 8,
    formFields: ["target_buyer", "pricing_model"],
    instruction: `Generate queries where pricing/budget is the primary concern, tailored to TARGET BUYER.

Vary:
- "Free [category] for [buyer segment, e.g., startups]"
- "Affordable [category] under $[realistic price for segment]"
- "Best value [category] for [buyer company size]"
- "[Category] with a free tier for [buyer context]"

Match the budget language to the buyer segment: startups say "free tier", enterprise says "cost-effective at scale".`,
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
        console.error("Query cluster generation failed:", result.reason)
      }
    }

    return allQueries.slice(0, this.limits.maxQueries)
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

    const prompt = `You are generating realistic search queries that a real user might ask an AI assistant (ChatGPT, Claude, Perplexity).

PRODUCT CONTEXT:
${contextParts.join("\n")}

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
      console.error(`Failed to parse ${intent} queries:`, cleaned.slice(0, 200))
      return []
    }
  }
}
