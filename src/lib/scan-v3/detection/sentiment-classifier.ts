const POSITIVE_SIGNALS = [
  "recommend",
  "highly recommend",
  "top pick",
  "best choice",
  "excellent",
  "outstanding",
  "leading",
  "popular choice",
  "well-regarded",
  "well-known",
  "trusted",
  "reliable",
  "powerful",
  "robust",
  "versatile",
  "intuitive",
  "user-friendly",
  "standout",
  "go-to",
  "first choice",
  "top-rated",
  "best-in-class",
  "market leader",
  "industry leader",
  "widely used",
  "great option",
  "strong contender",
  "ideal for",
  "perfect for",
  "excels at",
  "shines in",
  "impressed by",
  "love using",
  "highly rated",
  "worth considering",
  "solid choice",
]

const NEGATIVE_SIGNALS = [
  "not recommend",
  "wouldn't recommend",
  "avoid",
  "lacks",
  "limited",
  "expensive",
  "overpriced",
  "buggy",
  "unreliable",
  "clunky",
  "outdated",
  "steep learning curve",
  "poor support",
  "frustrating",
  "disappointing",
  "inferior",
  "falls short",
  "not ideal",
  "drawback",
  "downside",
  "weakness",
  "shortcoming",
  "better alternatives",
  "not the best",
  "hard to use",
  "difficult to",
  "complicated",
  "underwhelming",
  "mediocre",
  "subpar",
]

const HEDGING_SIGNALS = [
  "however",
  "although",
  "on the other hand",
  "that said",
  "keep in mind",
  "worth noting",
  "caveat",
  "depending on",
  "trade-off",
  "trade off",
]

export function classifySentiment(
  responseText: string,
  brandContext: string
): "positive" | "neutral" | "negative" {
  const lower = responseText.toLowerCase()
  const brandLower = brandContext.toLowerCase()

  const brandIndex = lower.indexOf(brandLower)
  if (brandIndex === -1) return "neutral"

  // Extract a window around the brand mention for targeted analysis
  const windowStart = Math.max(0, brandIndex - 300)
  const windowEnd = Math.min(lower.length, brandIndex + brandLower.length + 300)
  const window = lower.slice(windowStart, windowEnd)

  let positiveScore = 0
  let negativeScore = 0

  for (const signal of POSITIVE_SIGNALS) {
    if (window.includes(signal)) positiveScore++
  }

  for (const signal of NEGATIVE_SIGNALS) {
    if (window.includes(signal)) negativeScore++
  }

  let hedgingCount = 0
  for (const signal of HEDGING_SIGNALS) {
    if (window.includes(signal)) hedgingCount++
  }

  // Hedging language softens positive sentiment
  if (hedgingCount >= 2) positiveScore = Math.max(0, positiveScore - 1)

  if (positiveScore > 0 && positiveScore > negativeScore) return "positive"
  if (negativeScore > 0 && negativeScore > positiveScore) return "negative"
  if (positiveScore > 0 && positiveScore === negativeScore) return "neutral"

  return "neutral"
}
