import type { Signal, MentionAnalysis, CompetitorResult, SourceResult } from "./types"
import { checkDescriptionAccuracy } from "./analyze-response"

interface SignalInput {
  brandName: string
  brandUrl: string
  userDescription: string
  chatgptAnalyses: MentionAnalysis[]
  claudeAnalyses: MentionAnalysis[]
  competitors: string[]
  competitorResults?: CompetitorResult[]
}

interface SignalContext {
  // Brand metrics
  mentionedInBothSources: boolean
  mentionedInOneSource: boolean
  mentionedInNone: boolean
  topThreeInBoth: boolean
  topThreeInOne: boolean
  topThreeInNone: boolean
  
  // Competitor metrics
  competitorsOutrankingUser: string[]
  competitorsWithLowerVisibility: string[]
  
  // Description metrics
  hasAccurateDescription: boolean
  hasInaccurateDescription: boolean
  aiDescriptions: string[]
}

/**
 * Detect visibility signals based on scan results
 */
export function detectSignals(input: SignalInput): Signal[] {
  const signals: Signal[] = []
  const context = buildContext(input)
  
  // 1. Category Association (most important)
  signals.push(detectCategoryAssociation(context, input))
  
  // 2. Competitive Position (new signal)
  signals.push(detectCompetitivePosition(context, input))
  
  // 3. Source Consistency
  signals.push(detectSourceConsistency(input.chatgptAnalyses, input.claudeAnalyses))
  
  // 4. Brand Recognition
  signals.push(detectBrandRecognition(input.chatgptAnalyses, input.claudeAnalyses, input.brandName))
  
  // 5. Description Accuracy (if we have descriptions)
  const descriptionSignal = detectDescriptionAccuracy(context, input)
  if (descriptionSignal) {
    signals.push(descriptionSignal)
  }
  
  // 6. Sentiment Analysis
  signals.push(detectSentiment(input.chatgptAnalyses, input.claudeAnalyses))
  
  // 7. Third-party Credibility
  signals.push(detectThirdPartyCredibility(input.chatgptAnalyses, input.claudeAnalyses))

  return signals.filter(Boolean)
}

/**
 * Build context object with aggregated metrics
 */
function buildContext(input: SignalInput): SignalContext {
  const chatgptMentioned = input.chatgptAnalyses.some(a => a.mentioned)
  const claudeMentioned = input.claudeAnalyses.some(a => a.mentioned)
  
  const chatgptTopThree = input.chatgptAnalyses.some(a => a.position === "top_3")
  const claudeTopThree = input.claudeAnalyses.some(a => a.position === "top_3")
  
  // Determine which competitors are outranking the user
  const userIsTopThree = chatgptTopThree || claudeTopThree
  const competitorsOutrankingUser: string[] = []
  const competitorsWithLowerVisibility: string[] = []
  
  if (input.competitorResults) {
    for (const comp of input.competitorResults) {
      if (comp.visibilityLevel === "recommended" && !userIsTopThree) {
        competitorsOutrankingUser.push(comp.name)
      } else if (comp.visibilityLevel !== "recommended" && userIsTopThree) {
        competitorsWithLowerVisibility.push(comp.name)
      }
    }
  } else {
    // Fall back to analyzing competitors from mention data
    const allAnalyses = [...input.chatgptAnalyses, ...input.claudeAnalyses]
    const competitorTopThree = new Set<string>()
    
    for (const analysis of allAnalyses) {
      for (const comp of analysis.competitors_in_top_3) {
        competitorTopThree.add(comp)
      }
    }
    
    for (const comp of input.competitors) {
      if (competitorTopThree.has(comp) && !userIsTopThree) {
        competitorsOutrankingUser.push(comp)
      } else if (!competitorTopThree.has(comp) && userIsTopThree) {
        competitorsWithLowerVisibility.push(comp)
      }
    }
  }
  
  // Collect AI descriptions
  const aiDescriptions = [
    ...input.chatgptAnalyses.filter(a => a.description).map(a => a.description!),
    ...input.claudeAnalyses.filter(a => a.description).map(a => a.description!),
  ]
  
  return {
    mentionedInBothSources: chatgptMentioned && claudeMentioned,
    mentionedInOneSource: (chatgptMentioned || claudeMentioned) && !(chatgptMentioned && claudeMentioned),
    mentionedInNone: !chatgptMentioned && !claudeMentioned,
    topThreeInBoth: chatgptTopThree && claudeTopThree,
    topThreeInOne: (chatgptTopThree || claudeTopThree) && !(chatgptTopThree && claudeTopThree),
    topThreeInNone: !chatgptTopThree && !claudeTopThree,
    competitorsOutrankingUser,
    competitorsWithLowerVisibility,
    hasAccurateDescription: false, // Will be determined async if needed
    hasInaccurateDescription: false,
    aiDescriptions,
  }
}

/**
 * Category Association Signal - how well does AI associate brand with category
 */
function detectCategoryAssociation(context: SignalContext, input: SignalInput): Signal {
  if (context.mentionedInBothSources && context.topThreeInBoth) {
    return {
      id: "category-association",
      name: "Category association",
      status: "success",
      explanation: "Both ChatGPT and Claude recommend you as a top choice in this category",
      confidence: "observed",
      details: "You're consistently recommended across AI platforms",
    }
  }
  
  if (context.mentionedInBothSources && context.topThreeInOne) {
    return {
      id: "category-association",
      name: "Category association",
      status: "success",
      explanation: "AI tools mention you, with one ranking you as a top choice",
      confidence: "observed",
      details: "Good visibility, but there's room to improve on one platform",
    }
  }
  
  if (context.mentionedInBothSources) {
    return {
      id: "category-association",
      name: "Category association",
      status: "warning",
      explanation: "AI tools know about you but don't rank you as a top recommendation",
      confidence: "observed",
      details: "You're in the conversation but not the first suggestion",
    }
  }
  
  if (context.mentionedInOneSource) {
    return {
      id: "category-association",
      name: "Category association",
      status: "warning",
      explanation: "Only one AI tool mentions you — your visibility is inconsistent",
      confidence: "observed",
      details: context.topThreeInOne 
        ? "You're a top pick on one platform but unknown on the other"
        : "Limited visibility on one platform, absent from the other",
    }
  }
  
  return {
    id: "category-association",
    name: "Category association",
    status: "error",
    explanation: "AI tools don't mention your product when users ask about this category",
    confidence: "observed",
    details: "You need to build presence in this space",
  }
}

/**
 * Competitive Position Signal - how does brand compare to competitors
 */
function detectCompetitivePosition(context: SignalContext, input: SignalInput): Signal {
  if (input.competitors.length === 0) {
    return {
      id: "competitive-position",
      name: "Competitive position",
      status: "warning",
      explanation: "No competitors specified — add some to see how you compare",
      confidence: "likely",
    }
  }

  const userIsTopThree = context.topThreeInBoth || context.topThreeInOne
  const userIsMentioned = context.mentionedInBothSources || context.mentionedInOneSource
  
  if (userIsTopThree && context.competitorsOutrankingUser.length === 0) {
    if (context.competitorsWithLowerVisibility.length > 0) {
      return {
        id: "competitive-position",
        name: "Competitive position",
        status: "success",
        explanation: "You're recommended ahead of your competitors",
        confidence: "observed",
        details: `${context.competitorsWithLowerVisibility.join(", ")} rank lower than you`,
      }
    }
    return {
      id: "competitive-position",
      name: "Competitive position",
      status: "success",
      explanation: "You're a top recommendation in your category",
      confidence: "observed",
    }
  }
  
  if (context.competitorsOutrankingUser.length > 0 && userIsMentioned) {
    return {
      id: "competitive-position",
      name: "Competitive position",
      status: "warning",
      explanation: `${context.competitorsOutrankingUser.join(" and ")} are recommended more prominently than you`,
      confidence: "observed",
      details: "You're in the conversation but not the top choice",
    }
  }
  
  if (context.competitorsOutrankingUser.length > 0 && !userIsMentioned) {
    return {
      id: "competitive-position",
      name: "Competitive position",
      status: "error",
      explanation: "Competitors dominate — you're not in the conversation",
      confidence: "observed",
      details: `${context.competitorsOutrankingUser.join(", ")} are being recommended while you're not mentioned`,
    }
  }
  
  return {
    id: "competitive-position",
    name: "Competitive position",
    status: "warning",
    explanation: "Neither you nor competitors are prominently featured",
    confidence: "observed",
    details: "The category may be new or AI doesn't have strong opinions yet",
  }
}

/**
 * Source Consistency Signal - do both AI sources agree
 */
function detectSourceConsistency(
  chatgptAnalyses: MentionAnalysis[],
  claudeAnalyses: MentionAnalysis[]
): Signal {
  const chatgptMentionCount = chatgptAnalyses.filter(a => a.mentioned).length
  const claudeMentionCount = claudeAnalyses.filter(a => a.mentioned).length
  
  const chatgptRatio = chatgptMentionCount / Math.max(chatgptAnalyses.length, 1)
  const claudeRatio = claudeMentionCount / Math.max(claudeAnalyses.length, 1)
  
  const difference = Math.abs(chatgptRatio - claudeRatio)

  // Also check position consistency
  const chatgptTopThree = chatgptAnalyses.some(a => a.position === "top_3")
  const claudeTopThree = claudeAnalyses.some(a => a.position === "top_3")
  const positionConsistent = chatgptTopThree === claudeTopThree

  if (difference < 0.2 && positionConsistent) {
    return {
      id: "source-consistency",
      name: "Source consistency",
      status: "success",
      explanation: "Your visibility is consistent across ChatGPT and Claude",
      confidence: "observed",
    }
  }
  
  if (difference < 0.4 || positionConsistent) {
    const betterSource = chatgptRatio > claudeRatio ? "ChatGPT" : "Claude"
    return {
      id: "source-consistency",
      name: "Source consistency",
      status: "warning",
      explanation: `Your visibility varies between AI sources — stronger on ${betterSource}`,
      confidence: "observed",
    }
  }
  
  const betterSource = chatgptRatio > claudeRatio ? "ChatGPT" : "Claude"
  const worseSource = chatgptRatio > claudeRatio ? "Claude" : "ChatGPT"
  return {
    id: "source-consistency",
    name: "Source consistency",
    status: "error",
    explanation: `${betterSource} mentions you, but ${worseSource} rarely does`,
    confidence: "observed",
  }
}

/**
 * Brand Recognition Signal - does AI know what the brand is
 */
function detectBrandRecognition(
  chatgptAnalyses: MentionAnalysis[],
  claudeAnalyses: MentionAnalysis[],
  brandName: string
): Signal {
  const allAnalyses = [...chatgptAnalyses, ...claudeAnalyses]
  const withDescription = allAnalyses.filter(a => a.mentioned && a.description && a.description.length > 20)
  
  if (withDescription.length >= 2) {
    return {
      id: "brand-recognition",
      name: "Brand recognition",
      status: "success",
      explanation: `AI tools know ${brandName} and can describe what it does`,
      confidence: "observed",
    }
  }
  
  if (withDescription.length === 1) {
    return {
      id: "brand-recognition",
      name: "Brand recognition",
      status: "warning",
      explanation: `AI has limited knowledge about ${brandName}`,
      confidence: "observed",
      details: "Only one source can describe your product in detail",
    }
  }
  
  const mentioned = allAnalyses.filter(a => a.mentioned).length
  if (mentioned > 0) {
    return {
      id: "brand-recognition",
      name: "Brand recognition",
      status: "warning",
      explanation: `AI mentions ${brandName} but can't describe it well`,
      confidence: "observed",
      details: "Your product is known but not well understood",
    }
  }
  
  return {
    id: "brand-recognition",
    name: "Brand recognition",
    status: "error",
    explanation: `AI doesn't recognize ${brandName}`,
    confidence: "observed",
    details: "Build more online presence so AI can learn about you",
  }
}

/**
 * Description Accuracy Signal - does AI describe the product correctly
 */
function detectDescriptionAccuracy(context: SignalContext, input: SignalInput): Signal | null {
  if (context.aiDescriptions.length === 0) {
    return null
  }

  // Compare descriptions with user's positioning
  const userLower = input.userDescription.toLowerCase()
  const userTerms = userLower
    .split(/\s+/)
    .filter(word => word.length > 4)
    .slice(0, 10)

  let accurateCount = 0
  let inaccurateCount = 0
  let bestDescription = ""

  for (const desc of context.aiDescriptions) {
    const descLower = desc.toLowerCase()
    const matchingTerms = userTerms.filter(term => descLower.includes(term))
    const matchRatio = matchingTerms.length / Math.max(userTerms.length, 1)

    if (matchRatio >= 0.4) {
      accurateCount++
      if (desc.length > bestDescription.length) bestDescription = desc
    } else if (matchRatio < 0.2) {
      inaccurateCount++
    }
  }

  if (accurateCount > 0 && inaccurateCount === 0) {
    return {
      id: "description-accuracy",
      name: "Description accuracy",
      status: "success",
      explanation: "AI accurately describes what your product does",
      confidence: "observed",
    }
  }
  
  if (inaccurateCount > 0) {
    return {
      id: "description-accuracy",
      name: "Description accuracy",
      status: "error",
      explanation: "AI describes your product differently than your actual positioning",
      confidence: "observed",
      details: "This mismatch can hurt your visibility for the right use cases",
    }
  }
  
  return {
    id: "description-accuracy",
    name: "Description accuracy",
    status: "warning",
    explanation: "AI's description partially matches your positioning",
    confidence: "observed",
  }
}

/**
 * Sentiment Analysis Signal - how positively does AI talk about the brand
 */
function detectSentiment(
  chatgptAnalyses: MentionAnalysis[],
  claudeAnalyses: MentionAnalysis[]
): Signal {
  const allAnalyses = [...chatgptAnalyses, ...claudeAnalyses]
  const withSentiment = allAnalyses.filter(a => a.mentioned && a.sentiment)
  
  if (withSentiment.length === 0) {
    return {
      id: "sentiment",
      name: "AI sentiment",
      status: "warning",
      explanation: "Not enough data to determine how AI feels about your product",
      confidence: "likely",
    }
  }

  const recommended = withSentiment.filter(a => a.sentiment === "recommended").length
  const negative = withSentiment.filter(a => a.sentiment === "negative").length
  const total = withSentiment.length

  if (negative > 0) {
    return {
      id: "sentiment",
      name: "AI sentiment",
      status: "error",
      explanation: "Some AI responses express concerns about your product",
      confidence: "observed",
      details: "Review what AI is saying and address any misconceptions",
    }
  }

  if (recommended / total >= 0.5) {
    return {
      id: "sentiment",
      name: "AI sentiment",
      status: "success",
      explanation: "AI actively recommends your product",
      confidence: "observed",
    }
  }

  return {
    id: "sentiment",
    name: "AI sentiment",
    status: "warning",
    explanation: "AI mentions you neutrally without strong endorsement",
    confidence: "observed",
  }
}

/**
 * Third-party Credibility Signal - inferred from confidence and consistency
 */
function detectThirdPartyCredibility(
  chatgptAnalyses: MentionAnalysis[],
  claudeAnalyses: MentionAnalysis[]
): Signal {
  const allAnalyses = [...chatgptAnalyses, ...claudeAnalyses]
  const validAnalyses = allAnalyses.filter(a => a.confidence > 0)
  
  if (validAnalyses.length === 0) {
    return {
      id: "third-party-credibility",
      name: "Third-party coverage",
      status: "warning",
      explanation: "Can't determine third-party coverage from available data",
      confidence: "likely",
    }
  }

  const avgConfidence = validAnalyses.reduce((sum, a) => sum + a.confidence, 0) / validAnalyses.length
  const consistentDescriptions = new Set(
    validAnalyses.filter(a => a.description).map(a => a.description!.slice(0, 50))
  ).size <= 2

  if (avgConfidence >= 0.8 && consistentDescriptions) {
    return {
      id: "third-party-credibility",
      name: "Third-party coverage",
      status: "success",
      explanation: "AI is confident about your product — likely covered by multiple sources",
      confidence: "likely",
    }
  }
  
  if (avgConfidence >= 0.5) {
    return {
      id: "third-party-credibility",
      name: "Third-party coverage",
      status: "warning",
      explanation: "You may have limited third-party coverage in this category",
      confidence: "likely",
      details: "Get listed in industry roundups and comparison articles",
    }
  }
  
  return {
    id: "third-party-credibility",
    name: "Third-party coverage",
    status: "error",
    explanation: "Few third-party sources seem to mention you in this category",
    confidence: "likely",
    details: "AI relies on external sources — build more online presence",
  }
}
