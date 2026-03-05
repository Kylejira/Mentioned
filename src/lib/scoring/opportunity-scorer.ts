// ---------------------------------------------------------------------------
// Opportunity Scorer — Pure computation, zero LLM calls
// Scores a discovered conversation 0–100 across 6 signals.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EngagementMetrics {
  upvotes?: number
  comments?: number
  replies?: number
  retweets?: number
  likes?: number
}

export interface DiscoveredConversation {
  text: string
  full_thread_text?: string
  platform: string
  posted_at: string
  engagement: EngagementMetrics
}

export type OpportunityTier = "hot" | "strong" | "moderate" | "low" | "cold"

export interface SignalBreakdown {
  intent: number
  keyword_match: number
  engagement: number
  recency: number
  competition: number
  platform: number
}

export interface OpportunityScore {
  total: number
  tier: OpportunityTier
  signals: SignalBreakdown
  reasons: string[]
  scored_at: string
}

interface SignalResult {
  score: number
  reasons: string[]
}

// ---------------------------------------------------------------------------
// 2.1 Intent Strength (0–30 points)
// ---------------------------------------------------------------------------

const TIER_1_PATTERNS = [
  /\b(best|top)\s+(tool|app|software|platform|service)\s+(for|to)\b/i,
  /\brecommend\s+(a|me|some)\b/i,
  /\balternatives?\s+to\b/i,
  /\bwhat\s+(should|do)\s+(i|you|we)\s+use\b/i,
  /\blooking\s+for\s+(a|an|some)\s+(tool|app|software|platform)\b/i,
  /\bswitch(ing)?\s+from\b/i,
  /\breplace(ment)?\s+for\b/i,
  /\bvs\b|\bversus\b|\bcompare\b/i,
  /\bneed\s+(a|an|some)\s+(tool|solution|platform)\b/i,
  /\bpaying\s+for|\bworth\s+(buying|paying)\b/i,
]

const TIER_2_PATTERNS = [
  /\bany(one|body)\s+(use|using|tried|know)\b/i,
  /\bwhat('s|\s+is)\s+the\s+best\b/i,
  /\bhow\s+do\s+(you|i|we)\b/i,
  /\bsuggestions?\s+for\b/i,
  /\btrying\s+to\s+(find|choose|decide)\b/i,
  /\bfree\s+(alternative|option|tool)\b/i,
  /\bopen\s+source\s+(alternative|option)\b/i,
]

const TIER_3_PATTERNS = [
  /\bthoughts\s+on\b/i,
  /\bopinions?\s+(on|about)\b/i,
  /\bexperience\s+with\b/i,
  /\breview(s)?\s+(of|for)\b/i,
  /\bwhat\s+do\s+you\s+think\b/i,
]

export function scoreIntent(text: string): SignalResult {
  const reasons: string[] = []

  const t1Matches = TIER_1_PATTERNS.filter((p) => p.test(text))
  if (t1Matches.length > 0) {
    reasons.push("Strong buying intent detected")
    return { score: Math.min(30, 25 + t1Matches.length), reasons }
  }

  const t2Matches = TIER_2_PATTERNS.filter((p) => p.test(text))
  if (t2Matches.length > 0) {
    reasons.push("Moderate recommendation intent")
    return { score: Math.min(24, 15 + t2Matches.length * 2), reasons }
  }

  const t3Matches = TIER_3_PATTERNS.filter((p) => p.test(text))
  if (t3Matches.length > 0) {
    reasons.push("Discussion with some intent signals")
    return { score: Math.min(14, 5 + t3Matches.length * 2), reasons }
  }

  return { score: 0, reasons: ["No buying intent detected"] }
}

// ---------------------------------------------------------------------------
// 2.2 Keyword Match Quality (0–25 points)
// ---------------------------------------------------------------------------

export function scoreKeywordMatch(
  conversationText: string,
  userQuery: string,
  productKeywords: string[]
): SignalResult {
  const reasons: string[] = []
  const lower = conversationText.toLowerCase()
  const queryWords = userQuery
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2)

  const queryMatches = queryWords.filter((w) => lower.includes(w)).length
  const queryMatchRate = queryWords.length > 0 ? queryMatches / queryWords.length : 0

  const kwMatches = productKeywords.filter((kw) => lower.includes(kw.toLowerCase())).length
  const kwMatchRate = productKeywords.length > 0 ? kwMatches / productKeywords.length : 0

  const combinedRate = queryMatchRate * 0.6 + kwMatchRate * 0.4
  const score = Math.round(combinedRate * 25)

  if (combinedRate > 0.7) reasons.push("Strong category match")
  else if (combinedRate > 0.4) reasons.push("Good category relevance")
  else if (combinedRate > 0) reasons.push("Partial keyword match")

  return { score, reasons }
}

// ---------------------------------------------------------------------------
// 2.3 Engagement Level (0–15 points)
// ---------------------------------------------------------------------------

export function scoreEngagement(
  metrics: EngagementMetrics,
  platform: string
): SignalResult {
  const reasons: string[] = []
  let engagementValue = 0

  if (platform === "reddit") {
    engagementValue = (metrics.upvotes || 0) + (metrics.comments || 0) * 3
  } else if (platform === "twitter") {
    engagementValue =
      (metrics.replies || 0) * 3 + (metrics.retweets || 0) * 2 + (metrics.likes || 0)
  } else {
    engagementValue = (metrics.comments || 0) * 2 + (metrics.replies || 0) * 2
  }

  const score = Math.min(15, Math.round(Math.log2(engagementValue + 1) * 2.2))

  if (score >= 12) reasons.push("High engagement thread")
  else if (score >= 6) reasons.push("Active conversation")
  else if (score > 0) reasons.push("Some engagement")

  return { score, reasons }
}

// ---------------------------------------------------------------------------
// 2.4 Recency (0–15 points)
// ---------------------------------------------------------------------------

export function scoreRecency(postedAt: Date): SignalResult {
  const reasons: string[] = []
  const hoursAgo = (Date.now() - postedAt.getTime()) / (1000 * 60 * 60)

  let score: number
  if (hoursAgo < 1) {
    score = 15
    reasons.push("Posted less than 1 hour ago")
  } else if (hoursAgo < 6) {
    score = 13
    reasons.push("Posted within last 6 hours")
  } else if (hoursAgo < 24) {
    score = 11
    reasons.push("Posted today")
  } else if (hoursAgo < 72) {
    score = 8
    reasons.push("Posted within last 3 days")
  } else if (hoursAgo < 168) {
    score = 5
    reasons.push("Posted within last week")
  } else if (hoursAgo < 720) {
    score = 2
    reasons.push("Posted within last month")
  } else {
    score = 0
    reasons.push("Old thread — replies unlikely to be seen")
  }

  return { score, reasons }
}

// ---------------------------------------------------------------------------
// 2.5 Competition Level (0–10 points)
// ---------------------------------------------------------------------------

const RECOMMENDATION_PATTERN = /\b(try|check out|i use|we use|i recommend|go with)\b/gi

export function scoreCompetition(
  threadText: string,
  knownCompetitors: string[]
): SignalResult {
  const reasons: string[] = []
  const lower = threadText.toLowerCase()

  const mentionedComps = knownCompetitors.filter((c) => lower.includes(c.toLowerCase()))

  const recCount = (threadText.match(RECOMMENDATION_PATTERN) || []).length
  const competitionLevel = mentionedComps.length + Math.min(3, recCount)

  let score: number
  if (competitionLevel === 0) {
    score = 10
    reasons.push("No product recommendations yet")
  } else if (competitionLevel <= 2) {
    score = 7
    reasons.push("Few product replies so far")
  } else if (competitionLevel <= 5) {
    score = 4
    reasons.push("Several products already recommended")
  } else {
    score = 1
    reasons.push("Thread saturated with recommendations")
  }

  return { score, reasons }
}

// ---------------------------------------------------------------------------
// 2.6 Platform Weight (0–5 points)
// ---------------------------------------------------------------------------

const PLATFORM_SCORES: Record<string, number> = {
  reddit: 5,
  twitter: 3,
  hackernews: 4,
  producthunt: 4,
  quora: 3,
  discourse: 3,
}

const DEFAULT_PLATFORM_SCORE = 2

export function scorePlatform(platform: string): SignalResult {
  const score = PLATFORM_SCORES[platform.toLowerCase()] ?? DEFAULT_PLATFORM_SCORE
  return { score, reasons: [`Platform: ${platform}`] }
}

// ---------------------------------------------------------------------------
// 3. Composite Scoring Engine
// ---------------------------------------------------------------------------

export function scoreOpportunity(
  conversation: DiscoveredConversation,
  userQuery: string,
  productKeywords: string[],
  knownCompetitors: string[]
): OpportunityScore {
  // Truncate very long texts for intent scoring (full text for competition)
  const intentText = conversation.text.length > 3000
    ? conversation.text.slice(0, 3000)
    : conversation.text

  const intent = scoreIntent(intentText)
  const match = scoreKeywordMatch(intentText, userQuery, productKeywords)
  const engagement = scoreEngagement(conversation.engagement, conversation.platform)
  const recency = scoreRecency(new Date(conversation.posted_at))

  // Competition uses full thread text if available
  const competitionText = conversation.full_thread_text || conversation.text
  const competition = knownCompetitors.length > 0
    ? scoreCompetition(competitionText, knownCompetitors)
    : { score: 5, reasons: ["Competition unknown — no competitors provided"] }

  const platform = scorePlatform(conversation.platform)

  const total =
    intent.score +
    match.score +
    engagement.score +
    recency.score +
    competition.score +
    platform.score

  const tier: OpportunityTier =
    total >= 80 ? "hot"
    : total >= 60 ? "strong"
    : total >= 40 ? "moderate"
    : total >= 20 ? "low"
    : "cold"

  const allReasons = [
    ...intent.reasons,
    ...match.reasons,
    ...engagement.reasons,
    ...recency.reasons,
    ...competition.reasons,
  ].filter((r) => !r.startsWith("No ") && !r.startsWith("Old "))

  return {
    total,
    tier,
    signals: {
      intent: intent.score,
      keyword_match: match.score,
      engagement: engagement.score,
      recency: recency.score,
      competition: competition.score,
      platform: platform.score,
    },
    reasons: allReasons.slice(0, 4),
    scored_at: new Date().toISOString(),
  }
}
