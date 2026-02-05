// Mock/Demo data for the Mentioned dashboard
// This is shown only when no real scan has been run yet
// Brand name clearly indicates this is demo data

export type VisibilityStatus = "recommended" | "low-visibility" | "not-mentioned"

export type SourceResult = {
  source: "chatgpt" | "claude"
  mentioned: boolean
  position: "top-3" | "mentioned" | "not-found"
  description: string | null
  descriptionAccurate: boolean
}

export type QueryResult = {
  query: string
  chatgpt: boolean
  claude: boolean
  isCustom?: boolean // True if this was a user-provided custom query
  variationGroup?: string // Groups related query variations together
}

export type Competitor = {
  name: string
  mentioned: boolean
  visibilityLevel: VisibilityStatus
  description: string | null
  mentionCount?: number
  topThreeCount?: number
  totalQueries?: number
  outranksUser?: boolean
  isDiscovered?: boolean // True if found in AI responses but not added by user
}

export type Signal = {
  id: string
  status: "success" | "warning" | "error"
  name: string
  explanation: string
  confidence: "observed" | "likely"
}

export type Action = {
  id: string
  priority: 1 | 2 | 3
  title: string
  why: string
  what: string
  draftContent: string
}

export type RawResponse = {
  query: string
  chatgpt_response: string | null
  claude_response: string | null
}

export type WhyNotMentioned = {
  reasons: string[]
  suggestions: string[]
}

export type QueryDimension = 
  | "quality" 
  | "features" 
  | "performance" 
  | "ease_of_use" 
  | "price" 
  | "reputation"
  | "style"        // Physical products: design, aesthetics
  | "comfort"      // Physical products: fit, feel
  | "durability"   // Physical products: longevity
  | "general"

export type DimensionScore = {
  dimension: QueryDimension
  label: string
  score: number
  queriesCount: number
  mentionCount: number
}

export type VisibilityScore = {
  overall: number // 0-100 percentage
  breakdown: {
    mentionRate: number // % of queries where brand was mentioned
    avgPosition: number | null // Average position when mentioned (lower = better)
    topThreeRate: number // % of mentions that were in top 3
    modelConsistency: number // % agreement between models
  }
  byModel: {
    chatgpt: number // 0-100 score for ChatGPT
    claude: number // 0-100 score for Claude
  }
  byDimension?: DimensionScore[] // Breakdown by query dimension
  trend?: "up" | "down" | "stable" | null
}

export type ContentRecommendation = {
  id: string
  priority: "high" | "medium" | "low"
  category: "content" | "technical" | "authority" | "positioning"
  title: string
  description: string
  impact: string
  action: string
  example?: string
}

export type ContentStrategy = {
  pagesAnalyzed: number
  hasComparisonPages: boolean
  hasFAQSection: boolean
  hasFAQSchema: boolean
  hasProductSchema: boolean
  hasCaseStudies: boolean
  hasTestimonials: boolean
  hasPricingPage: boolean
  hasIntegrations: boolean
  valuePropositionClarity: "clear" | "somewhat_clear" | "unclear"
  uniqueDifferentiators: string[]
  missingContent: string[]
  recommendations: ContentRecommendation[]
}

// NEW: Visibility gap found by comparing user's site to competitors
export type VisibilityGap = {
  category: "content" | "positioning" | "authority"
  type: string
  impact: "high" | "medium" | "low"
  description: string
  competitor_reference: string | null
  user_status?: string
  competitor_status?: string
}

// NEW: Actionable item with content generation support
export type ActionItem = {
  id: string
  number: number
  category: "content" | "positioning" | "authority" | "social_proof" | "comparison" | "faq"
  type: string
  title: string
  // Evidence-based fields (new)
  what_we_found?: string | null
  competitor_comparison?: string | null
  why_it_matters?: string | null
  // Legacy field
  why?: string
  what_to_do: string
  competitor_example?: string | null
  effort: "30 mins" | "1-2 hours" | "2-3 hours" | "half day" | "1-2 days"
  impact: "high" | "medium" | "low"
  generate_type: "comparison_page" | "headline" | "faq" | "testimonial_email" | "use_case_page" | null
}

export type ScanData = {
  brand: {
    name: string
    website: string
    category: string
  }
  status: VisibilityStatus
  visibilityScore?: VisibilityScore // New: trackable visibility score
  statusMessage: string
  sources: SourceResult[]
  queries: QueryResult[]
  competitors: Competitor[]
  signals: Signal[]
  actions: Action[]
  scanDate: string
  rawResponses?: RawResponse[]
  whyNotMentioned?: WhyNotMentioned
  contentStrategy?: ContentStrategy // Content analysis and recommendations
  visibilityGaps?: VisibilityGap[] // NEW: Gaps found by comparing to competitors
  actionItems?: ActionItem[] // NEW: Specific actions with generate support
  productData?: any // Raw product data from scan
}

export const mockScanData: ScanData = {
  brand: {
    name: "[Demo] Run a scan to see your results",
    website: "example.com",
    category: "software",
  },
  status: "low-visibility",
  statusMessage: "Mentioned, but not recommended",
  sources: [
    {
      source: "chatgpt",
      mentioned: true,
      position: "mentioned",
      description: "Teamflow is a project management tool that helps teams organize tasks and collaborate on projects.",
      descriptionAccurate: true,
    },
    {
      source: "claude",
      mentioned: true,
      position: "not-found",
      description: "Teamflow appears to be a task management solution, though I don't have detailed information about its specific features.",
      descriptionAccurate: false,
    },
  ],
  queries: [
    {
      query: "Best project management tools",
      chatgpt: true,
      claude: false,
    },
    {
      query: "Project management for remote teams",
      chatgpt: true,
      claude: true,
    },
    {
      query: "Teamflow alternatives",
      chatgpt: false,
      claude: false,
    },
    {
      query: "Simple project management software",
      chatgpt: false,
      claude: true,
    },
  ],
  competitors: [
    {
      name: "Asana",
      mentioned: true,
      visibilityLevel: "recommended",
      description: "A comprehensive work management platform for teams to organize, track, and manage their work.",
    },
    {
      name: "Monday.com",
      mentioned: true,
      visibilityLevel: "recommended",
      description: "A flexible work operating system that powers teams to run projects and workflows with confidence.",
    },
    {
      name: "Notion",
      mentioned: true,
      visibilityLevel: "low-visibility",
      description: "An all-in-one workspace for notes, docs, and project management.",
    },
  ],
  signals: [
    {
      id: "category-association",
      status: "success",
      name: "Category association",
      explanation: "AI connects your product to the project management category",
      confidence: "observed",
    },
    {
      id: "comparison-content",
      status: "error",
      name: "Comparison content",
      explanation: "Your site doesn't have content comparing you to alternatives",
      confidence: "observed",
    },
    {
      id: "question-coverage",
      status: "warning",
      name: "Question coverage",
      explanation: "Your site answers some but not all common questions users ask",
      confidence: "observed",
    },
    {
      id: "brand-consistency",
      status: "success",
      name: "Brand consistency",
      explanation: "Your positioning is consistent across sources",
      confidence: "likely",
    },
    {
      id: "third-party-mentions",
      status: "error",
      name: "Third-party mentions",
      explanation: "Few other sites mention you in the project management category",
      confidence: "likely",
    },
    {
      id: "positioning-clarity",
      status: "warning",
      name: "Positioning clarity",
      explanation: "AI's description partially matches your actual product positioning",
      confidence: "observed",
    },
  ],
  actions: [
    {
      id: "action-1",
      priority: 1,
      title: "Create a comparison page",
      why: "AI tools often reference comparison content when making recommendations.",
      what: "Create a page comparing Teamflow to Asana and Monday.com. Focus on specific use cases like remote team collaboration and async work. Be honest about trade-offs — AI trusts balanced content.",
      draftContent: `# Teamflow vs. Asana vs. Monday.com: Which Is Right for Your Team?

## Quick Comparison

| Feature | Teamflow | Asana | Monday.com |
|---------|----------|-------|------------|
| Best for | Remote-first teams | Large organizations | Visual project tracking |
| Starting price | $8/user/mo | $10.99/user/mo | $9/user/mo |
| Free tier | Yes (up to 10 users) | Yes (up to 15 users) | Yes (up to 2 users) |
| Mobile app | iOS, Android | iOS, Android | iOS, Android |

## When to choose Teamflow

Teamflow is ideal if you:
- Have a distributed or remote-first team
- Value async communication alongside task management
- Want a simpler interface without overwhelming features
- Need seamless timezone coordination

## When to choose Asana

Asana might be better if you:
- Manage complex, cross-functional projects
- Need advanced reporting and portfolios
- Have a larger organization with many teams
- Require enterprise-grade security features

## When to choose Monday.com

Monday.com could be your pick if you:
- Prefer highly visual project boards
- Need extensive customization options
- Want strong automation capabilities
- Manage client-facing projects

## The honest trade-offs

**Teamflow's limitations:** Fewer integrations than competitors, smaller ecosystem, less suitable for enterprise-scale deployments.

**Asana's limitations:** Can feel complex for small teams, higher learning curve, more expensive at scale.

**Monday.com's limitations:** Can become costly with add-ons, some features feel overwhelming, mobile experience isn't as polished.

## Our recommendation

Choose based on your team's primary need:
- **Simplicity + Remote work** → Teamflow
- **Scale + Enterprise** → Asana  
- **Visual + Customization** → Monday.com`,
    },
    {
      id: "action-2",
      priority: 2,
      title: "Add an FAQ section",
      why: "Users ask AI questions your site doesn't currently answer.",
      what: "Add an FAQ page covering: 'What is Teamflow?', 'How does Teamflow compare to Asana?', 'Teamflow pricing', and 'Is Teamflow good for remote teams?'. Use natural language that matches how people ask questions.",
      draftContent: `# Frequently Asked Questions

## What is Teamflow?

Teamflow is a project management platform designed specifically for remote and distributed teams. We help teams organize work, track progress, and collaborate asynchronously — without the overhead of complex enterprise tools.

## How is Teamflow different from Asana or Monday.com?

While Asana and Monday.com are excellent tools, they're built for large organizations with complex needs. Teamflow is purpose-built for remote-first teams who want:

- **Simpler setup:** Get your team running in minutes, not weeks
- **Async-first design:** Built for teams across timezones
- **Focused features:** Everything you need, nothing you don't

## What does Teamflow cost?

We offer simple, transparent pricing:

- **Free:** Up to 10 users, core features included
- **Pro:** $8/user/month — unlimited users, advanced features
- **Business:** $15/user/month — priority support, custom integrations

No hidden fees. No surprise charges. Cancel anytime.

## Is Teamflow good for remote teams?

Yes! Remote teams are our primary focus. Features built for distributed work:

- Timezone-aware scheduling and deadlines
- Async updates that don't require real-time meetings
- Built-in status sharing so everyone knows who's online
- Threaded discussions that keep context in one place

## Can I import from other tools?

Yes. We support direct imports from Asana, Trello, Monday.com, and Notion. Most teams complete migration in under an hour.

## Do you offer a free trial?

Our Free tier isn't a trial — it's a full-featured free plan for teams up to 10 people. Use it as long as you want. Upgrade only when you need more.`,
    },
    {
      id: "action-3",
      priority: 3,
      title: "Clarify homepage positioning",
      why: "AI describes you differently than your homepage does.",
      what: "Update your hero section to clearly state what you do and who it's for. Current AI descriptions mention 'task management' but your homepage says 'team collaboration'. Align these messages.",
      draftContent: `# Homepage Hero Section Copy

## Option A: Direct & Specific

**Headline:** Project management for remote teams

**Subheadline:** Organize work, track progress, and collaborate across timezones — without the complexity of enterprise tools.

**CTA:** Start free →

---

## Option B: Benefit-focused

**Headline:** Your remote team's work, finally organized

**Subheadline:** Teamflow brings together tasks, updates, and conversations in one place. Built for teams that don't work in the same room.

**CTA:** Try Teamflow free →

---

## Option C: Differentiator-led

**Headline:** Project management, minus the bloat

**Subheadline:** Asana and Monday.com are great — for enterprises. Teamflow is built for remote teams who want power without complexity.

**CTA:** See the difference →

---

## Key messaging to include below the fold:

1. **For remote-first teams** — "Built from day one for distributed work"
2. **Simple to start** — "Get your team running in minutes"
3. **Async by design** — "Updates without meetings, progress without pings"

## Words to use:
- Remote teams, distributed, async
- Simple, focused, streamlined
- Project management, task tracking, team coordination

## Words to avoid:
- Enterprise, scalable, robust (too corporate)
- Revolutionary, game-changing (too hypey)
- Collaboration platform (too vague)`,
    },
  ],
  scanDate: "2026-01-22T14:30:00Z",
}

// Helper to format date
export function formatScanDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}
