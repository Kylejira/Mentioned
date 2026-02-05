// Scan Types

export interface ScanInput {
  brandId: string
  brandName: string
  brandUrl: string
  description: string
  category: string
  categories?: string[] // User-provided search categories (e.g., "yoga", "fitness", "running")
  competitors: string[]
  customQueries?: string[] // User-provided custom queries
  queryCount?: number // Number of queries to run (12 for free, 25 for paid)
}

// Enhanced scan input after URL analysis
export interface EnhancedScanInput extends ScanInput {
  // From URL analysis
  extractedKeywords: string[]
  extractedFeatures: string[]
  extractedCategory: string | null
  extractedDescription: string | null
  targetAudience: string | null
  useCases: string[]
  // Combined competitors (user-provided + discovered)
  allCompetitors: string[]
  // Whether URL analysis was performed
  urlAnalyzed: boolean
  // Location/region detection
  detectedCountry: string | null // e.g., "Germany", "United States"
  detectedCountryCode: string | null // e.g., "DE", "US"
  isLocationBound: boolean // True if service is region-specific
  // AI-assisted industry classification
  industryType: string | null // e.g., "healthcare", "fintech", "car_rental"
  productType: "physical" | "software" | "service" | null
  industryTerminology: {
    singular: string
    plural: string
    verbPhrase: string
  } | null
}

// Response quality indicators
export interface ResponseQuality {
  score: number // 0-100, higher is better
  isDeflection: boolean // AI refused to give specific recommendations
  isGeneric: boolean // Response is too generic/vague
  isOffTopic: boolean // Response doesn't answer the query
  hasSpecificBrands: boolean // Response mentions specific brands
  issueType: "none" | "deflection" | "generic" | "off_topic" | "knowledge_cutoff" | "refusal" | null
  issueDetail: string | null // Human-readable description of the issue
}

export interface MentionAnalysis {
  mentioned: boolean
  position: "top_3" | "mentioned_not_top" | "not_found"
  exactPosition: number | null // 1-based position (1 = first mentioned, null = not mentioned)
  sentiment: "recommended" | "neutral" | "negative" | null
  description: string | null
  competitors_mentioned: string[]
  competitors_in_top_3: string[]
  other_brands_mentioned: string[] // Other brands found in response
  response_type: "list_recommendations" | "single_recommendation" | "comparison" | "general_advice" | "unclear"
  confidence: number // 0-1 score
  responseQuality?: ResponseQuality // Quality assessment of the AI response
}

export interface QueryResult {
  query: string
  chatgpt: {
    response: string
    analysis: MentionAnalysis
  } | null
  claude: {
    response: string
    analysis: MentionAnalysis
  } | null
}

export interface SourceResult {
  source: "chatgpt" | "claude"
  mentioned: boolean
  position: "top_3" | "mentioned" | "not_found"
  sentiment: "recommended" | "neutral" | "negative" | null
  description: string | null
  descriptionAccuracy: "accurate" | "partially_accurate" | "inaccurate" | "not_mentioned"
  descriptionIssue: string | null
  mentionCount: number // How many queries resulted in mentions
  topThreeCount: number // How many queries resulted in top 3
  totalQueries: number
}

export interface Signal {
  id: string
  name: string
  status: "success" | "warning" | "error"
  explanation: string
  confidence: "observed" | "likely"
  details?: string // Additional context
}

export interface Action {
  id: string
  priority: 1 | 2 | 3
  title: string
  why: string
  what: string
  category: "content" | "positioning" | "visibility" | "competitive"
}

export interface CompetitorResult {
  name: string
  mentioned: boolean
  mentionCount: number
  topThreeCount: number
  totalQueries: number
  visibilityLevel: "recommended" | "low_visibility" | "not_mentioned"
  description: string | null
  outranksUser: boolean // Does this competitor rank higher than the user's brand?
  isDiscovered: boolean // True if found in AI responses but not added by user
}

export type VisibilityStatus = "not_mentioned" | "low_visibility" | "recommended"

// Query dimensions for categorized scoring
// These dimensions are mapped to specific industries for relevant rating categories
export type QueryDimension = 
  // Universal dimensions (all industries)
  | "quality"           // Overall quality
  | "reputation"        // Trust, reviews, brand recognition
  | "value"             // Price-to-quality ratio
  | "customer_service"  // Support, responsiveness
  
  // Software dimensions
  | "features"          // Functionality, capabilities
  | "performance"       // Speed, reliability, uptime
  | "ease_of_use"       // User-friendliness, learning curve
  | "price"             // Cost, pricing model
  
  // Physical product dimensions
  | "style"             // Design, aesthetics
  | "comfort"           // Fit, feel, wearability
  | "durability"        // Longevity, materials
  
  // Service dimensions
  | "convenience"       // Locations, hours, accessibility
  | "reliability"       // Consistency, dependability
  | "selection"         // Options, variety, range
  
  // Industry-specific dimensions
  | "coverage"          // Insurance: what's covered, policy options
  | "claims_process"    // Insurance: ease of claims, payout speed
  | "fleet_quality"     // Car rental: vehicle condition, variety
  | "rates_fees"        // Banking: interest rates, fee transparency
  | "digital_experience" // Banking/Finance: app, online tools
  | "expertise"         // Professional services: knowledge, skill
  | "communication"     // Professional services: responsiveness, clarity
  | "food_quality"      // Restaurants: taste, freshness, ingredients
  | "ambiance"          // Restaurants/Hotels: atmosphere, decor
  | "cleanliness"       // Hotels/Healthcare: hygiene standards
  | "location"          // Hotels/Real estate: accessibility, area
  | "amenities"         // Hotels: facilities, extras
  | "wait_times"        // Healthcare: appointment availability
  | "care_quality"      // Healthcare: treatment effectiveness
  | "safety"            // Automotive/Travel: safety ratings
  | "network"           // Telecom/Healthcare: coverage area, providers
  
  | "general"           // Fallback for unmatched queries

// Dimension score breakdown
export interface DimensionScore {
  dimension: QueryDimension
  label: string // Human-readable label
  score: number // 0-100
  queriesCount: number // How many queries tested this dimension
  mentionCount: number // How many times mentioned in this dimension
}

// Visibility score breakdown for tracking
export interface VisibilityScore {
  overall: number // 0-100 percentage
  breakdown: {
    mentionRate: number // % of queries where brand was mentioned
    avgPosition: number | null // Average position when mentioned (lower = better)
    topThreeRate: number // % of mentions that were in top 3
    modelConsistency: number // % agreement between models (both mention or both don't)
  }
  byModel: {
    chatgpt: number // 0-100 score for ChatGPT
    claude: number // 0-100 score for Claude
  }
  byDimension: DimensionScore[] // Breakdown by query dimension
  trend?: "up" | "down" | "stable" | null // For comparing to previous scans
}

export interface RawQueryResponse {
  query: string
  chatgpt_response: string | null
  claude_response: string | null
}

export interface ScanResult {
  status: VisibilityStatus
  visibilityScore: VisibilityScore // New: trackable visibility score
  sources: {
    chatgpt: SourceResult
    claude: SourceResult
  }
  queries_tested: {
    query: string
    chatgpt: boolean
    claude: boolean
    chatgptPosition?: number | null // Exact position in ChatGPT response
    claudePosition?: number | null // Exact position in Claude response
    dimension?: QueryDimension // What dimension this query tests
    isCustom?: boolean // Whether this was a user-provided custom query
    variationGroup?: string // Groups related query variations together (e.g., "best_tools_v1")
  }[]
  signals: Signal[]
  actions: Action[]
  competitor_results: CompetitorResult[]
  raw_responses?: RawQueryResponse[] // For viewing actual AI responses
  brandName?: string
  brandUrl?: string
  category?: string
  timestamp?: string
  // URL analysis results
  urlAnalysis?: {
    extractedKeywords: string[]
    extractedFeatures: string[]
    extractedDescription: string | null
    targetAudience: string | null
    useCases: string[]
    discoveredCompetitors: string[]
    confidence: number
  }
  // Why not mentioned analysis
  whyNotMentioned?: {
    reasons: string[]
    suggestions: string[]
  }
  // Content strategy analysis and recommendations
  contentStrategy?: {
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
    recommendations: {
      id: string
      priority: "high" | "medium" | "low"
      category: "content" | "technical" | "authority" | "positioning"
      title: string
      description: string
      impact: string
      action: string
      example?: string
    }[]
  }
}

// Analysis response from AI
export interface AnalysisResponse {
  brand_mentioned: boolean
  brand_position: "top_3" | "mentioned_not_top" | "not_mentioned"
  brand_exact_position: number | null // 1-based position (null if not mentioned)
  brand_sentiment: "recommended" | "neutral" | "negative" | null
  brand_description: string | null
  competitors_mentioned: string[]
  competitors_in_top_3: string[]
  other_brands_mentioned?: string[] // Other brands found in response
  response_type: "list_recommendations" | "single_recommendation" | "comparison" | "general_advice" | "unclear"
}

// Description accuracy check response
export interface AccuracyCheckResponse {
  accuracy: "accurate" | "partially_accurate" | "inaccurate" | "not_mentioned"
  issue: string | null
}
