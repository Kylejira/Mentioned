import { log } from "@/lib/logger"
import type { ProductProfile } from "./website-analyzer"
import type { GeneratedQuery } from "./query-discovery-generator"

const logger = log.create("query-quality-filter")

// ---------------------------------------------------------------------------
// High-intent signal patterns
// ---------------------------------------------------------------------------

const HIGH_INTENT_PATTERNS = [
  "best",
  "recommend",
  "alternative",
  "vs",
  "looking for",
  "need a",
  "tool for",
  "anyone use",
  "suggest",
  "which",
  "should i",
  "how do i",
  "how can i",
  "i need",
  "struggling",
  "help me",
  "trying to",
  "what do you use",
  "what tools",
  "any good",
  "comparable to",
  "similar to",
  "instead of",
  "something like",
  "choosing between",
]

// ---------------------------------------------------------------------------
// Filter 1: Brand name leak
// ---------------------------------------------------------------------------

function containsBrandName(query: string, productName: string): boolean {
  const q = query.toLowerCase()
  const name = productName.toLowerCase()

  if (q.includes(name)) return true

  // Also check individual words for multi-word product names (>= 4 chars to avoid false positives)
  const words = name.split(/\s+/).filter((w) => w.length >= 4)
  for (const word of words) {
    if (q.includes(word)) return true
  }

  return false
}

// ---------------------------------------------------------------------------
// Filter 2 & 3: Length constraints
// ---------------------------------------------------------------------------

function isTooShort(query: string): boolean {
  return query.length < 15
}

function isTooLong(query: string): boolean {
  return query.length > 200
}

// ---------------------------------------------------------------------------
// Filter 4: Too generic — must contain at least one niche term
// ---------------------------------------------------------------------------

function isTooGeneric(query: string, profile: ProductProfile): boolean {
  const q = query.toLowerCase()

  const nicheTerms = [
    ...profile.keywords,
    ...profile.key_features,
    profile.category,
    profile.subcategory,
    ...profile.competitors,
  ]
    .filter(Boolean)
    .map((t) => t.toLowerCase())

  // Check if at least one niche term (or a significant substring of it) appears
  for (const term of nicheTerms) {
    if (q.includes(term)) return false
    // Check individual words of multi-word terms (>= 4 chars)
    const termWords = term.split(/\s+/).filter((w) => w.length >= 4)
    for (const word of termWords) {
      if (q.includes(word)) return false
    }
  }

  return true
}

// ---------------------------------------------------------------------------
// Filter 5: Duplicate detection (>70% word overlap)
// ---------------------------------------------------------------------------

function isDuplicate(
  query: GeneratedQuery,
  index: number,
  allQueries: GeneratedQuery[]
): boolean {
  const words = new Set(
    query.query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2) // ignore tiny words like "a", "to", "is"
  )

  // Only compare against earlier queries to keep the first occurrence
  for (let i = 0; i < index; i++) {
    const otherWords = new Set(
      allQueries[i].query
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2)
    )

    const intersection = [...words].filter((w) => otherWords.has(w))
    const overlap = intersection.length / Math.max(words.size, otherWords.size)

    if (overlap > 0.7) return true
  }

  return false
}

// ---------------------------------------------------------------------------
// Filter 6: Low intent — must match at least one high-intent pattern
// ---------------------------------------------------------------------------

function hasHighIntent(query: string): boolean {
  const q = query.toLowerCase()
  return HIGH_INTENT_PATTERNS.some((pattern) => q.includes(pattern))
}

// ---------------------------------------------------------------------------
// Main filter pipeline
// ---------------------------------------------------------------------------

export function filterQueries(
  candidates: GeneratedQuery[],
  profile: ProductProfile
): GeneratedQuery[] {
  const rejected: { query: string; reason: string }[] = []

  const filtered = candidates.filter((q, index) => {
    if (containsBrandName(q.query, profile.product_name)) {
      rejected.push({ query: q.query, reason: "brand_name_leak" })
      return false
    }

    if (isTooShort(q.query)) {
      rejected.push({ query: q.query, reason: "too_short" })
      return false
    }

    if (isTooLong(q.query)) {
      rejected.push({ query: q.query, reason: "too_long" })
      return false
    }

    if (isTooGeneric(q.query, profile)) {
      rejected.push({ query: q.query, reason: "too_generic" })
      return false
    }

    if (isDuplicate(q, index, candidates)) {
      rejected.push({ query: q.query, reason: "duplicate" })
      return false
    }

    if (!hasHighIntent(q.query)) {
      rejected.push({ query: q.query, reason: "low_intent" })
      return false
    }

    return true
  })

  // Cap at 20
  const final = filtered.slice(0, 20)

  logger.info("Query quality filter applied", {
    product: profile.product_name,
    input: candidates.length,
    output: final.length,
    rejected: rejected.length,
    rejectionReasons: rejected.reduce(
      (acc, r) => {
        acc[r.reason] = (acc[r.reason] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    ),
  })

  if (rejected.length > 0) {
    logger.debug("Rejected queries", {
      rejected: rejected.map((r) => `[${r.reason}] ${r.query}`),
    })
  }

  return final
}
