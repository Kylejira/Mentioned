import type { SaaSProfile } from "../profiler/types"
import type { GeneratedQuery, ValidatedQuery } from "./types"
import { createHash } from "crypto"

type BiasChecked = GeneratedQuery & { has_brand_bias: boolean }
type Deduped = BiasChecked & { dedupe_hash: string }

/**
 * Stateless query validation pipeline (Refinement 2).
 * Same instance can validate queries for different profiles.
 */
export class QueryValidator {
  constructor(
    private llmCall: (prompt: string) => Promise<string>
  ) {}

  async validate(
    queries: GeneratedQuery[],
    profile: SaaSProfile
  ): Promise<ValidatedQuery[]> {
    const biasChecked = queries.map((q) => ({
      ...q,
      has_brand_bias: QueryValidator.hasBrandBias(q.text, profile),
    }))

    const deduped = QueryValidator.deduplicate(biasChecked)
    const diverse = QueryValidator.semanticDedupe(deduped)

    const batches = QueryValidator.chunk(diverse, 20)
    const validated: ValidatedQuery[] = []
    for (const batch of batches) {
      const results = await this.batchValidate(batch, profile)
      validated.push(...results)
    }

    return validated.filter(
      (q) => q.is_relevant && !q.has_brand_bias && q.intent_score >= 3
    )
  }

  static hasBrandBias(query: string, profile: SaaSProfile): boolean {
    const lower = query.toLowerCase()
    const terms = [
      profile.brand_name.toLowerCase(),
      ...profile.brand_aliases.map((a) => a.toLowerCase()),
    ]
    return terms.some((term) => {
      if (term.length < 3) return false
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const regex = new RegExp(`\\b${escaped}\\b`, "i")
      return regex.test(lower)
    })
  }

  static deduplicate(queries: BiasChecked[]): Deduped[] {
    const seen = new Set<string>()
    const results: Deduped[] = []

    for (const q of queries) {
      const normalized = q.text
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .replace(/\s+/g, " ")
        .trim()
      const hash = createHash("md5").update(normalized).digest("hex").slice(0, 12)

      if (!seen.has(hash)) {
        seen.add(hash)
        results.push({ ...q, dedupe_hash: hash })
      }
    }
    return results
  }

  /**
   * Jaccard similarity over token sets (Refinement 5).
   * Catches near-duplicate queries that survive hash dedup.
   */
  static semanticDedupe<T extends { text: string }>(queries: T[]): T[] {
    const kept: T[] = []
    const keptTokens: Set<string>[] = []

    for (const q of queries) {
      const tokens = QueryValidator.tokenize(q.text)
      const isDuplicate = keptTokens.some(
        (existing) => QueryValidator.jaccardSimilarity(tokens, existing) > 0.75
      )
      if (!isDuplicate) {
        kept.push(q)
        keptTokens.push(tokens)
      }
    }
    return kept
  }

  static tokenize(text: string): Set<string> {
    return new Set(
      text
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .split(/\s+/)
        .filter((t) => t.length > 2)
    )
  }

  static jaccardSimilarity(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 && b.size === 0) return 1.0
    let intersection = 0
    for (const token of a) {
      if (b.has(token)) intersection++
    }
    const union = a.size + b.size - intersection
    return union === 0 ? 0 : intersection / union
  }

  private async batchValidate(
    queries: Deduped[],
    profile: SaaSProfile
  ): Promise<ValidatedQuery[]> {
    const prompt = `Rate each query for:
1. is_relevant: Would a real user ask this to find ${profile.category} software? (true/false)
2. intent_score: How realistic is this as an actual user query? (1=artificial, 5=very natural)

Product context: ${profile.category} tool for ${profile.target_audience}.

Queries:
${queries.map((q, i) => `${i + 1}. "${q.text}"`).join("\n")}

Respond ONLY with a JSON array:
[{"index": 1, "is_relevant": true, "intent_score": 4}, ...]`

    const raw = await this.llmCall(prompt)
    const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim()

    try {
      const ratings: { index: number; is_relevant: boolean; intent_score: number }[] =
        JSON.parse(cleaned)

      return queries.map((q, i) => {
        const rating = ratings.find((r) => r.index === i + 1)
        return {
          ...q,
          is_relevant: rating?.is_relevant ?? false,
          intent_score: rating?.intent_score ?? 1,
        }
      })
    } catch {
      return queries.map((q) => ({
        ...q,
        is_relevant: true,
        intent_score: 3,
      }))
    }
  }

  static chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size))
    }
    return chunks
  }
}
