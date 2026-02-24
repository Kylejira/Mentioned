import type { SaaSProfile } from "./types"
import type { ScanInput } from "../types/scan-input"

const PROFILE_EXTRACTION_PROMPT = `You are a SaaS product analyst. Given the following website content, extract a structured profile.

Respond ONLY with valid JSON matching this exact schema:
{
  "brand_name": "string",
  "domain": "string",
  "tagline": "string",
  "category": "string",
  "subcategory": "string",
  "target_audience": "string",
  "core_features": ["string"],
  "pricing_model": "string",
  "competitors_mentioned": ["string"],
  "key_differentiators": ["string"],
  "use_cases": ["string"],
  "brand_aliases": ["string"],
  "core_problem": "string",
  "target_buyer": "string"
}

Rules:
- brand_aliases: include common abbreviations, the domain without TLD, and any alternate names found on the site
- core_features: max 8, prioritize by prominence on the page
- competitors_mentioned: only include if explicitly named on the site
- core_problem: identify the primary pain point the product addresses
- target_buyer: identify the specific person/role who would buy this
- If a field cannot be determined, use empty string or empty array

Website content:
`

export class SaaSProfiler {
  constructor(
    private llmCall: (prompt: string) => Promise<string>,
    private scrapeUrl: (url: string) => Promise<string>
  ) {}

  /**
   * Build profile from BOTH scraped content AND form input.
   * Form data takes precedence for fields the user explicitly provided.
   */
  async profile(url: string, input?: ScanInput): Promise<SaaSProfile> {
    const scraped = await this.scrapeAndExtract(url)

    if (!input) return scraped
    return this.mergeWithFormInput(scraped, input)
  }

  private async scrapeAndExtract(url: string): Promise<SaaSProfile> {
    const scrapedContent = await this.scrapeUrl(url)
    const truncated = scrapedContent.slice(0, 6000)

    const rawResponse = await this.llmCall(PROFILE_EXTRACTION_PROMPT + truncated)
    const parsed = this.parseProfileResponse(rawResponse)
    return this.validateProfile(parsed, url)
  }

  /**
   * Form data wins for fields the user filled in,
   * scraped data fills everything else.
   */
  private mergeWithFormInput(scraped: SaaSProfile, input: ScanInput): SaaSProfile {
    const domain = new URL(input.website_url).hostname.replace("www.", "")

    const allCompetitors = new Set<string>()
    for (const c of (input.competitors || [])) allCompetitors.add(c.trim())
    for (const c of (scraped.competitors_mentioned || [])) allCompetitors.add(c.trim())

    return {
      ...scraped,

      brand_name: input.brand_name.trim(),
      domain,

      core_problem: input.core_problem?.trim() || scraped.core_problem || "",
      target_buyer: input.target_buyer?.trim() || scraped.target_buyer || "",
      target_audience: scraped.target_audience || input.target_buyer?.trim() || "",

      user_differentiators: input.differentiators?.trim() || "",
      key_differentiators: this.mergeDifferentiators(
        scraped.key_differentiators,
        input.differentiators
      ),

      competitors_mentioned: [...allCompetitors].filter(Boolean),

      buyer_questions: (input.buyer_questions || [])
        .map((q) => q.trim())
        .filter((q) => q.length >= 10),

      brand_aliases: this.ensureAliases(scraped, input.brand_name, domain),
    }
  }

  private mergeDifferentiators(
    scraped: string[],
    userProvided?: string
  ): string[] {
    const result: string[] = []

    if (userProvided?.trim()) {
      const parts = userProvided
        .split(/[.\n]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 5)
      result.push(...parts)
    }

    for (const s of (scraped || [])) {
      const isDupe = result.some(
        (r) =>
          r.toLowerCase().includes(s.toLowerCase().slice(0, 20)) ||
          s.toLowerCase().includes(r.toLowerCase().slice(0, 20))
      )
      if (!isDupe) result.push(s)
    }

    return result.slice(0, 8)
  }

  private parseProfileResponse(raw: string): SaaSProfile {
    const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim()
    try {
      return JSON.parse(cleaned) as SaaSProfile
    } catch {
      throw new Error(`Failed to parse SaaS profile JSON: ${cleaned.slice(0, 200)}`)
    }
  }

  private validateProfile(profile: SaaSProfile, url: string): SaaSProfile {
    const domain = new URL(url).hostname.replace("www.", "")
    return {
      ...profile,
      brand_name: profile.brand_name || domain.split(".")[0],
      domain: profile.domain || domain,
      tagline: profile.tagline || "",
      category: profile.category || "software",
      subcategory: profile.subcategory || "",
      target_audience: profile.target_audience || "",
      core_features: profile.core_features || [],
      pricing_model: profile.pricing_model || "unknown",
      competitors_mentioned: profile.competitors_mentioned || [],
      key_differentiators: profile.key_differentiators || [],
      use_cases: profile.use_cases || [],
      brand_aliases: this.ensureAliases(profile, profile.brand_name, domain),
      core_problem: profile.core_problem || "",
      target_buyer: profile.target_buyer || "",
      user_differentiators: profile.user_differentiators || "",
      buyer_questions: profile.buyer_questions || [],
    }
  }

  private ensureAliases(profile: SaaSProfile, brandName: string, domain: string): string[] {
    const aliases = new Set(profile.brand_aliases || [])
    aliases.add(domain.split(".")[0])
    aliases.add(domain)
    if (brandName) {
      aliases.add(brandName.toLowerCase())
      const firstWord = brandName.split(/[\s.]/)[0]
      if (firstWord.length >= 3) aliases.add(firstWord.toLowerCase())
    }
    return [...aliases]
  }
}
