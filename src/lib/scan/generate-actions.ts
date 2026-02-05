import type { Action, Signal, VisibilityStatus, CompetitorResult, SourceResult } from "./types"

interface ActionInput {
  signals: Signal[]
  brandName: string
  competitors: string[]
  status: VisibilityStatus
  competitorResults?: CompetitorResult[]
  aiDescription?: string | null
  userDescription?: string
  sources?: {
    chatgpt: SourceResult
    claude: SourceResult
  }
}

/**
 * Generate personalized action plan based on scan results
 */
export function generateActions(input: ActionInput): Action[] {
  const { signals, brandName, competitors, status, competitorResults, aiDescription, userDescription, sources } = input
  const signalMap = new Map(signals.map(s => [s.id, s]))
  
  const actions: Action[] = []

  // Find competitors outranking the user
  const competitorsInTop3 = competitorResults
    ?.filter(c => c.visibilityLevel === "recommended")
    .map(c => c.name) || []
  
  const userInTop3 = sources?.chatgpt.position === "top_3" || sources?.claude.position === "top_3"

  // Check description accuracy
  const descriptionAccuracy = sources?.chatgpt.descriptionAccuracy || sources?.claude.descriptionAccuracy
  const descriptionIssue = sources?.chatgpt.descriptionIssue || sources?.claude.descriptionIssue

  if (status === "not_mentioned") {
    actions.push(...getNotMentionedActions(brandName, competitors, competitorsInTop3, signalMap))
  } else if (status === "low_visibility") {
    actions.push(...getLowVisibilityActions(
      brandName, 
      competitors, 
      competitorsInTop3, 
      userInTop3,
      descriptionAccuracy,
      descriptionIssue,
      aiDescription,
      userDescription,
      signalMap
    ))
  } else {
    actions.push(...getRecommendedActions(brandName, competitors, signalMap))
  }

  // Ensure we always return exactly 3 actions
  while (actions.length < 3) {
    actions.push(getDefaultAction(actions.length + 1, brandName, competitors, status))
  }

  // Ensure unique IDs by appending index
  return actions.slice(0, 3).map((action, idx) => ({
    ...action,
    id: `${action.id || 'action'}-${idx + 1}`,
    priority: (idx + 1) as 1 | 2 | 3,
  }))
}

function getNotMentionedActions(
  brandName: string,
  competitors: string[],
  competitorsInTop3: string[],
  signals: Map<string, Signal>
): Action[] {
  const actions: Action[] = []
  const competitorList = competitors.slice(0, 2).join(" and ") || "established players"

  // #1 Priority: Get into the conversation
  actions.push({
    id: "get-visibility",
    priority: 1,
    title: "Get into the conversation",
    why: "AI tools don't know about you yet. You need to build presence in your category.",
    what: `Focus on three things: (1) Create comparison content mentioning ${competitorList}, (2) Get listed on relevant "best of" roundups and directories, (3) Make sure your site clearly states your category — use the exact language users search with.`,
    category: "visibility",
  })

  // #2: Comparison page targeting top competitor
  if (competitorsInTop3.length > 0) {
    actions.push({
      id: "comparison-page",
      priority: 2,
      title: `Create a "${brandName} vs ${competitorsInTop3[0]}" comparison page`,
      why: `${competitorsInTop3[0]} is being recommended while you're not. Comparison content helps AI understand where you fit.`,
      what: `Create a dedicated comparison page with: specific use cases for each tool, feature-by-feature comparison, pricing breakdown, honest pros and cons for both, and clear guidance on who should choose which.`,
      category: "content",
    })
  } else {
    actions.push({
      id: "comparison-page",
      priority: 2,
      title: `Create comparison pages against ${competitorList}`,
      why: "Comparison content is the #1 factor in AI recommendations. Without it, you're invisible.",
      what: `Create dedicated comparison pages for your main competitors. Include feature matrices, use case recommendations, and honest trade-offs. AI trusts balanced, helpful content.`,
      category: "content",
    })
  }

  // #3: Check positioning signal
  const positioningSignal = signals.get("category-association")
  if (positioningSignal?.status === "error") {
    actions.push({
      id: "clarify-category",
      priority: 3,
      title: "Make your category crystal clear",
      why: "AI doesn't associate you with this category yet. You need to establish that connection.",
      what: `Update your homepage, meta descriptions, and about page to explicitly mention your category. If you're a "project management tool", say it clearly — don't just say "productivity solution".`,
      category: "positioning",
    })
  }

  return actions
}

function getLowVisibilityActions(
  brandName: string,
  competitors: string[],
  competitorsInTop3: string[],
  userInTop3: boolean,
  descriptionAccuracy: string | undefined,
  descriptionIssue: string | null | undefined,
  aiDescription: string | null | undefined,
  userDescription: string | undefined,
  signals: Map<string, Signal>
): Action[] {
  const actions: Action[] = []
  const competitorList = competitors.slice(0, 2).join(" and ") || "competitors"

  // If competitors are outranking the user
  if (competitorsInTop3.length > 0 && !userInTop3) {
    actions.push({
      id: "outrank-competitors",
      priority: 1,
      title: `Create a "${brandName} vs ${competitorsInTop3[0]}" comparison page`,
      why: `${competitorsInTop3[0]} is being recommended over you. Comparison content helps AI understand your differentiators.`,
      what: `Create a dedicated page comparing ${brandName} to ${competitorsInTop3[0]}. Be specific about: who each tool is best for, key feature differences, pricing comparison, and migration path. Be honest — don't just say you're better at everything.`,
      category: "competitive",
    })
  }

  // If AI description doesn't match reality
  if (descriptionAccuracy === "inaccurate" || descriptionAccuracy === "partially_accurate") {
    const priority = descriptionAccuracy === "inaccurate" ? 1 : 2
    actions.push({
      id: "fix-description",
      priority,
      title: "Fix how AI understands your product",
      why: aiDescription && userDescription 
        ? `AI describes you as "${truncate(aiDescription, 60)}" but you're actually "${truncate(userDescription, 60)}". This mismatch hurts your visibility.`
        : "AI's description doesn't match your actual positioning. This costs you recommendations.",
      what: `Update your homepage and meta descriptions to clearly state what you do. Use the exact language your customers use. Make sure your tagline, hero section, and about page all tell the same story.`,
      category: "positioning",
    })
  }

  // Check source consistency
  const consistencySignal = signals.get("source-consistency")
  if (consistencySignal?.status === "error") {
    actions.push({
      id: "improve-consistency",
      priority: 2,
      title: "Fix your visibility gap between AI sources",
      why: consistencySignal.explanation || "One AI mentions you much more than the other. You're missing half your potential recommendations.",
      what: `Check which AI source mentions you less and investigate why. It could be different training data cutoffs or content sources. Ensure your brand is mentioned consistently across review sites, directories, and comparison articles.`,
      category: "visibility",
    })
  }

  // Add FAQ if not enough actions
  if (actions.length < 2) {
    actions.push({
      id: "expand-faq",
      priority: 2,
      title: "Add FAQ content that mirrors user questions",
      why: "Users ask AI questions your site doesn't answer. An FAQ helps AI recommend you for the right queries.",
      what: `Add an FAQ page covering: "What is ${brandName}?", "How does ${brandName} compare to ${competitorList}?", "${brandName} pricing", and use-case specific questions like "Is ${brandName} good for small teams?"`,
      category: "content",
    })
  }

  return actions
}

function getRecommendedActions(
  brandName: string,
  competitors: string[],
  signals: Map<string, Signal>
): Action[] {
  const actions: Action[] = []
  const competitorList = competitors.slice(0, 2).join(" and ") || "competitors"

  // Frame actions as maintaining visibility, not fixing problems
  actions.push({
    id: "maintain-position",
    priority: 1,
    title: "Keep your comparison content fresh",
    why: "Great news — AI tools recommend you! Keep your content updated to maintain this position.",
    what: `Review your comparison pages quarterly. Update feature lists, add new use cases, ensure pricing is current, and mention any new competitors entering your space.`,
    category: "content",
  })

  // Check if any signals need attention even in recommended status
  const descriptionSignal = signals.get("description-accuracy")
  if (descriptionSignal?.status !== "success") {
    actions.push({
      id: "refine-positioning",
      priority: 2,
      title: "Refine how AI describes you",
      why: "You're recommended, but AI's description could be more accurate. Better descriptions mean better-qualified leads.",
      what: `Review how AI describes ${brandName} and tweak your website copy to align. Small improvements in how AI presents you can significantly impact click-through rates.`,
      category: "positioning",
    })
  } else {
    actions.push({
      id: "monitor-competitors",
      priority: 2,
      title: "Monitor competitor movements",
      why: "Your competitors will try to improve their AI visibility. Stay ahead by tracking changes.",
      what: `Run monthly scans to track how ${competitorList} appear in AI recommendations. If they gain ground, update your comparison content to maintain your advantage.`,
      category: "competitive",
    })
  }

  // Expand to adjacent categories
  actions.push({
    id: "expand-categories",
    priority: 3,
    title: "Expand to related categories",
    why: "You've won your main category. Capture more recommendations by expanding into adjacent searches.",
    what: `Identify related categories where ${brandName} could compete. Create content targeting queries like "best [adjacent category] tools" or "[use case] software" to capture more traffic.`,
    category: "visibility",
  })

  return actions
}

function getDefaultAction(
  priority: number,
  brandName: string,
  competitors: string[],
  status: VisibilityStatus
): Action {
  const competitorList = competitors.slice(0, 2).join(" and ") || "competitors"

  const defaults: Record<VisibilityStatus, Action[]> = {
    not_mentioned: [
      {
        id: "default-create-comparison",
        priority: 1,
        title: "Create comparison content",
        why: "Comparison content is the #1 factor in AI recommendations.",
        what: `Create a page comparing ${brandName} to ${competitorList} with honest, detailed analysis.`,
        category: "content",
      },
      {
        id: "default-build-presence",
        priority: 2,
        title: "Build category presence",
        why: "AI needs to see you mentioned in your category across multiple sources.",
        what: `Get listed in industry directories, roundup posts, and review sites. Each mention helps AI learn about you.`,
        category: "visibility",
      },
      {
        id: "default-clarify-messaging",
        priority: 3,
        title: "Clarify your messaging",
        why: "Clear messaging helps AI understand and recommend you.",
        what: `Make your homepage clearly state what ${brandName} is, who it's for, and how it compares to alternatives.`,
        category: "positioning",
      },
    ],
    low_visibility: [
      {
        id: "default-improve-positioning",
        priority: 1,
        title: "Improve positioning clarity",
        why: "AI knows you but doesn't strongly recommend you.",
        what: `Clarify your unique value proposition and create more comparison content to stand out.`,
        category: "positioning",
      },
      {
        id: "default-add-comparisons",
        priority: 2,
        title: "Add more comparison content",
        why: "Detailed comparisons help AI recommend you over alternatives.",
        what: `Create comparison pages for each major competitor with feature matrices and use case guidance.`,
        category: "content",
      },
      {
        id: "default-expand-faq",
        priority: 3,
        title: "Expand your FAQ section",
        why: "FAQs answer the questions users ask AI.",
        what: `Add FAQ content covering comparisons, pricing, and use-case specific questions.`,
        category: "content",
      },
    ],
    recommended: [
      {
        id: "default-maintain-content",
        priority: 1,
        title: "Keep content updated",
        why: "You're doing great! Maintain your position with fresh content.",
        what: `Review and update your comparison and FAQ content quarterly.`,
        category: "content",
      },
      {
        id: "default-track-competitors",
        priority: 2,
        title: "Track competitor changes",
        why: "Stay ahead of competitors improving their AI visibility.",
        what: `Monitor monthly how competitors appear in AI recommendations.`,
        category: "competitive",
      },
      {
        id: "default-expand-reach",
        priority: 3,
        title: "Expand to new categories",
        why: "Capture more recommendations in adjacent searches.",
        what: `Identify and target related categories where ${brandName} could compete.`,
        category: "visibility",
      },
    ],
  }

  const statusDefaults = defaults[status]
  return statusDefaults[Math.min(priority - 1, statusDefaults.length - 1)]
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 3) + "..."
}
