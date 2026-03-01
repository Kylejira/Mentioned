"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { StatusBadge, getStatusFromScore } from "@/components/ui/status-badge"
import { StatusIcon } from "@/components/ui/status-icon"
import { SlideOver } from "@/components/ui/slide-over"
import { SkeletonCard } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/toast"
import { useAuth } from "@/lib/auth"
import { useSubscription } from "@/lib/subscription"
import { UpgradePrompt } from "@/components/upgrade-prompt"
import { ScansRemaining } from "@/components/scans-remaining"
import { ScanLimitModal } from "@/components/upgrade-modal"
import { 
  ChevronDown, 
  Check, 
  X, 
  AlertTriangle,
  Sparkles,
  Copy,
  CheckCircle2,
  RefreshCw,
  Loader2,
  Clock,
  ArrowRight,
  RotateCw,
  Lock,
  Lightbulb,
  Target,
  Info,
  TrendingUp
} from "lucide-react"
import { cn } from "@/lib/utils"
import { mockScanData, formatScanDate, type Action, type ScanData, type VisibilityStatus, type VisibilityScore, type DimensionScore, type VisibilityGap, type ActionItem } from "@/lib/mock-data"
import { ProviderComparison } from "@/components/ProviderComparison"
import { ScoreDelta } from "./components/score-delta"
import { ShareOfVoice } from "./components/share-of-voice"
import { QueryExplorer } from "./components/query-explorer"
import { FeatureGate } from "@/components/ui/feature-gate"
import { canUseStrategicBrain } from "@/lib/plans/enforce"
import ReactMarkdown from "react-markdown"

const SCAN_RESULT_KEY = "mentioned_scan_result" // Legacy key (shared across users)
// New keys are scoped per-user: mentioned_scan_result_{userId}

// Transform API scan result to dashboard format
function transformScanResult(apiResult: any): ScanData | null {
  if (!apiResult) return null

  try {
    // Map status format (API uses underscore, UI uses hyphen)
    const mapStatus = (status: string): VisibilityStatus => {
      if (status === "not_mentioned") return "not-mentioned"
      if (status === "low_visibility") return "low-visibility"
      if (status === "recommended") return "recommended"
      return "not-mentioned"
    }

    // Map position format
    const mapPosition = (position: string): "top-3" | "mentioned" | "not-found" => {
      if (position === "top_3") return "top-3"
      if (position === "mentioned" || position === "mentioned_not_top") return "mentioned"
      return "not-found"
    }

    // Get status message
    const getStatusMessage = (status: string): string => {
      if (status === "not_mentioned" || status === "not-mentioned") 
        return "AI tools don't mention your product"
      if (status === "low_visibility" || status === "low-visibility") 
        return "Mentioned, but not recommended"
      if (status === "recommended") 
        return "AI tools actively recommend your product"
      return "Unknown status"
    }

    // Generate draft content for actions
    const generateDraftContent = (action: any, brandName: string, competitors: string[]): string => {
      const competitorList = competitors.slice(0, 2).join(" and ") || "competitors"
      
      if (action.title.toLowerCase().includes("comparison")) {
        return `# ${brandName} vs. ${competitorList}: Which Is Right for Your Team?

## Quick Comparison

Start with a comparison table highlighting key differences in:
- Target audience
- Pricing
- Key features
- Best use cases

## When to choose ${brandName}

[List 3-4 scenarios where your product excels]

## When to choose alternatives

[Be honest about when competitors might be better choices]

## The honest trade-offs

[Acknowledge your product's limitations - this builds trust with AI models]

## Our recommendation

Choose based on your specific needs. ${brandName} is ideal for [your key differentiator].`
      }
      
      if (action.title.toLowerCase().includes("faq")) {
        return `# Frequently Asked Questions

## What is ${brandName}?

[Clear 2-3 sentence description of what you do]

## How is ${brandName} different from ${competitorList}?

[Key differentiators - be specific and honest]

## What does ${brandName} cost?

[Clear pricing breakdown with all tiers]

## Is ${brandName} good for [your target audience]?

[Explain why your product is well-suited for your target market]

## Can I import from other tools?

[Migration/integration information]

## Do you offer a free trial?

[Trial or free tier details]`
      }
      
      return `# ${action.title}

## Recommended approach

${action.what}

## Why this matters

${action.why}

## Next steps

1. [First action item]
2. [Second action item]
3. [Third action item]`
    }

    const status = mapStatus(apiResult.status)
    const brandName = apiResult.brandName || "Your product"
    const competitors = apiResult.competitor_results?.map((c: any) => c.name) || []
    
    // Extract visibility score from API result
    // Handle both old format (total) and new format (overall)
    const rawScore = apiResult.visibilityScore
    const visibilityScore: VisibilityScore | undefined = rawScore ? {
      // Support both 'overall' and 'total' field names
      overall: rawScore.overall ?? rawScore.total ?? rawScore.score ?? 0,
      breakdown: {
        mentionRate: rawScore.breakdown?.mentionRate ?? rawScore.overall?.percentage ?? 0,
        avgPosition: rawScore.breakdown?.avgPosition ?? rawScore.averagePosition ?? null,
        topThreeRate: rawScore.breakdown?.topThreeRate ?? 0,
        modelConsistency: rawScore.breakdown?.modelConsistency ?? 0,
      },
      byModel: {
        chatgpt: rawScore.byModel?.chatgpt ?? rawScore.chatgpt?.percentage ?? 0,
        claude: rawScore.byModel?.claude ?? rawScore.claude?.percentage ?? 0,
      },
      byDimension: rawScore.byDimension || [],
      trend: rawScore.trend || null,
    } : undefined
    
    console.log("[Dashboard Transform] Visibility score:", {
      rawOverall: rawScore?.overall,
      rawTotal: rawScore?.total,
      rawScore: rawScore?.score,
      transformedOverall: visibilityScore?.overall,
      breakdown: visibilityScore?.breakdown
    })

    return {
      brand: {
        name: brandName,
        website: apiResult.brandUrl || "",
        category: apiResult.category || "products", // Changed from "software" - better default
      },
      status,
      visibilityScore,
      statusMessage: getStatusMessage(apiResult.status),
      sources: [
        {
          source: "chatgpt" as const,
          mentioned: apiResult.sources?.chatgpt?.mentioned || false,
          position: mapPosition(apiResult.sources?.chatgpt?.position || "not_found"),
          description: apiResult.sources?.chatgpt?.description || null,
          descriptionAccurate: apiResult.sources?.chatgpt?.descriptionAccurate || false,
        },
        {
          source: "claude" as const,
          mentioned: apiResult.sources?.claude?.mentioned || false,
          position: mapPosition(apiResult.sources?.claude?.position || "not_found"),
          description: apiResult.sources?.claude?.description || null,
          descriptionAccurate: apiResult.sources?.claude?.descriptionAccurate || false,
        },
      ],
      queries: (() => {
        const raw = apiResult.queries_tested || apiResult.queries || []
        if (!Array.isArray(raw)) return []
        return raw.map((q: any) => ({
          query: q.query || q,
          chatgpt: q.chatgpt ?? q.chatGPT ?? false,
          claude: q.claude ?? q.Claude ?? false,
          isCustom: q.isCustom || false,
        }))
      })(),
      competitors: (apiResult.competitor_results || []).map((c: any) => ({
        name: c.name,
        mentioned: c.mentioned || false,
        visibilityLevel: mapStatus(c.visibilityLevel || "not_mentioned"),
        description: c.description || null,
        mentionCount: c.mentionCount || 0,
        topThreeCount: c.topThreeCount || 0,
        totalQueries: c.totalQueries || (Array.isArray(apiResult.queries_tested) ? apiResult.queries_tested.length : apiResult.queries_tested) || 6,
        outranksUser: c.outranksUser || false,
        isDiscovered: c.isDiscovered || false,
      })),
      // Handle signals - can be array or object with recommendations
      signals: (() => {
        // If signals is an array, use it directly
        if (Array.isArray(apiResult.signals)) {
          return apiResult.signals.map((s: any) => ({
        id: s.id,
        status: s.status as "success" | "warning" | "error",
        name: s.name,
        explanation: s.explanation,
        confidence: s.confidence as "observed" | "likely",
          }))
        }
        // If signals is an object with recommendations, convert to array format
        if (apiResult.signals?.recommendations) {
          return apiResult.signals.recommendations.map((rec: string, idx: number) => ({
            id: `signal-${idx + 1}`,
            status: "warning" as const,
            name: rec,
            explanation: rec,
            confidence: "likely" as const,
          }))
        }
        // Default empty array
        return []
      })(),
      // Handle actions - can be array with different formats
      actions: (() => {
        const actionsArray = Array.isArray(apiResult.actions) ? apiResult.actions : []
        return actionsArray.map((a: any, idx: number) => ({
        id: a.id || `action-${idx + 1}`,
          priority: (a.priority === "high" ? 1 : a.priority === "medium" ? 2 : a.priority || idx + 1) as 1 | 2 | 3,
          title: a.title || a.description || "Action item",
          why: a.why || a.impact || "",
          what: a.what || a.description || "",
        draftContent: generateDraftContent(a, brandName, competitors),
        }))
      })(),
      scanDate: apiResult.timestamp || new Date().toISOString(),
      rawResponses: apiResult.raw_responses || [],
      whyNotMentioned: apiResult.whyNotMentioned || null,
      // NEW: Gap analysis and action items
      visibilityGaps: (apiResult.visibility_factors || []).map((gap: any) => ({
        category: gap.category,
        type: gap.type,
        impact: gap.impact,
        description: gap.description,
        competitor_reference: gap.competitor_reference,
        user_status: gap.user_status,
        competitor_status: gap.competitor_status,
      })),
      actionItems: (apiResult.action_items || []).map((item: any) => ({
        id: item.id,
        number: item.number,
        category: item.category,
        type: item.type,
        title: item.title,
        // Support both old and new formats
        what_we_found: item.what_we_found || null,
        competitor_comparison: item.competitor_comparison || null,
        why_it_matters: item.why_it_matters || item.why || null,
        what_to_do: item.what_to_do,
        competitor_example: item.competitor_example,
        effort: item.effort,
        impact: item.impact,
        generate_type: item.generate_type,
      })),
      productData: apiResult.productData || null,
    }
  } catch (e) {
    console.error("Error transforming scan result:", e)
    return null
  }
}

// Calculate visibility score as percentage
function calculateVisibilityScore(mentionCount: number, topThreeCount: number, totalQueries: number): number {
  if (totalQueries === 0) return 0
  // Weight: mention = 50%, top 3 = additional 50%
  const mentionScore = (mentionCount / totalQueries) * 50
  const topThreeScore = mentionCount > 0 ? (topThreeCount / mentionCount) * 50 : 0
  return Math.round(mentionScore + topThreeScore)
}

// Get visibility score label
function getScoreLabel(score: number): string {
  if (score >= 70) return "Excellent"
  if (score >= 50) return "Good"
  if (score >= 30) return "Moderate"
  if (score > 0) return "Low"
  return "Not visible"
}

// Get score color
function getScoreColor(score: number): string {
  if (score >= 70) return "text-status-success"
  if (score >= 50) return "text-[#10B981]"
  if (score >= 30) return "text-status-warning"
  if (score > 0) return "text-orange-500"
  return "text-status-error"
}

// Get score background color
function getScoreBgColor(score: number): string {
  if (score >= 70) return "bg-status-success"
  if (score >= 50) return "bg-[#10B981]"
  if (score >= 30) return "bg-status-warning"
  if (score > 0) return "bg-orange-500"
  return "bg-status-error"
}

// Dimension icons - industry-specific rating categories
const dimensionIcons: Record<string, string> = {
  // Universal dimensions
  quality: "✨",
  reputation: "⭐",
  value: "💎",
  customer_service: "🎧",
  
  // Software dimensions
  features: "🔧",
  performance: "⚡",
  ease_of_use: "👆",
  price: "💰",
  
  // Physical product dimensions
  style: "🎨",
  comfort: "🛋️",
  durability: "💪",
  
  // Service dimensions
  convenience: "📍",
  reliability: "✅",
  selection: "📦",
  
  // Industry-specific dimensions
  coverage: "🛡️",           // Insurance
  claims_process: "📋",     // Insurance
  fleet_quality: "🚗",      // Car rental
  rates_fees: "💵",         // Banking
  digital_experience: "📱", // Banking/Finance
  expertise: "🎓",          // Professional services
  communication: "💬",      // Professional services
  food_quality: "🍽️",       // Restaurants
  ambiance: "✨",           // Restaurants/Hotels
  cleanliness: "🧹",        // Hotels/Healthcare
  location: "📍",           // Hotels/Real estate
  amenities: "🏊",          // Hotels
  wait_times: "⏱️",         // Healthcare
  care_quality: "❤️",       // Healthcare
  safety: "🛡️",            // Automotive/Travel
  network: "📶",            // Telecom/Healthcare
  
  // General fallback
  general: "📊"
}

// Visibility Score Display Component
function VisibilityScoreDisplay({ score, deltas }: { score: VisibilityScore; deltas?: Record<string, any> | null }) {
  const [showDimensions, setShowDimensions] = useState(false)
  const overallScore = score.overall
  const label = getScoreLabel(overallScore)
  const textColor = getScoreColor(overallScore)
  const bgColor = getScoreBgColor(overallScore)
  
  return (
    <div className="bg-background border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">Visibility Score</h3>
        <Link href="/progress" className="text-xs text-blue-600 font-medium underline hover:no-underline">
          Trackable
        </Link>
      </div>
      
      {/* Main Score */}
      <div className="flex items-end gap-3 mb-4">
        <span className={cn("text-5xl font-bold", textColor)}>
          {overallScore}
        </span>
        <span className="text-2xl text-muted-foreground mb-1">/100</span>
        <span className={cn("text-sm font-medium mb-2 ml-2", textColor)}>
          {label}
        </span>
        {deltas?.overall?.delta != null && (
          <span className="mb-2">
            <ScoreDelta delta={deltas.overall.delta} suffix=" pts" size="md" />
          </span>
        )}
      </div>
      
      {/* Progress Bar */}
      <div className="h-3 bg-muted rounded-full overflow-hidden mb-6">
        <div 
          className={cn("h-full rounded-full transition-all duration-500", bgColor)}
          style={{ width: `${overallScore}%` }}
        />
      </div>
      
      {/* Breakdown Grid */}
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Mention rate</p>
          <div className="flex items-center gap-2">
            <p className="text-lg font-bold text-gray-900">
              {score.breakdown.mentionRate}%
            </p>
            {deltas?.mention_rate?.delta != null && (
              <ScoreDelta delta={deltas.mention_rate.delta * 100} suffix="%" />
            )}
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Top 3 rate</p>
          <p className="text-lg font-bold text-gray-900">
            {score.breakdown.topThreeRate}%
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Avg. position</p>
          <p className="text-lg font-bold text-gray-900">
            {score.breakdown.avgPosition !== null 
              ? `#${score.breakdown.avgPosition}` 
              : "N/A"}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Model agreement</p>
          <div className="flex items-center gap-2">
            <p className="text-lg font-bold text-gray-900">
              {score.breakdown.modelConsistency}%
            </p>
            {deltas?.consistency?.delta != null && (
              <ScoreDelta delta={deltas.consistency.delta} suffix="%" />
            )}
          </div>
        </div>
      </div>
      
      {/* Per-Model Scores */}
      <div className="mt-6 pt-4 border-t border-border">
        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-3">Score by AI model</p>
        <div className="flex gap-6">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-foreground">ChatGPT</span>
              <span className="text-xs font-semibold text-foreground">{score.byModel.chatgpt}</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#10a37f] rounded-full transition-all"
                style={{ width: `${score.byModel.chatgpt}%` }}
              />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-foreground">Claude</span>
              <span className="text-xs font-semibold text-foreground">{score.byModel.claude}</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#cc785c] rounded-full transition-all"
                style={{ width: `${score.byModel.claude}%` }}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Dimension Breakdown - Collapsible */}
      {score.byDimension && score.byDimension.length > 0 && (
        <div className="mt-6 pt-4 border-t border-border">
          <button
            onClick={() => setShowDimensions(!showDimensions)}
            className="w-full flex items-center justify-between text-left group"
          >
            <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
              Score by category
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-primary font-medium">
                {showDimensions ? "Hide" : "Show breakdown"}
              </span>
              <ChevronDown 
                className={cn(
                  "size-4 text-primary transition-transform",
                  showDimensions && "rotate-180"
                )} 
              />
            </div>
          </button>
          
          {showDimensions && (
            <div className="mt-4 space-y-3 animate-fade-in">
              {score.byDimension.map((dimension) => (
                <DimensionScoreRow key={dimension.dimension} dimension={dimension} />
              ))}
              <p className="text-[10px] text-muted-foreground mt-2 pt-2 border-t border-border">
                Scores based on how AI responds to queries about each category
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Individual dimension score row
function DimensionScoreRow({ dimension }: { dimension: DimensionScore }) {
  const score = dimension.score
  const color = getScoreColor(score)
  const bgColor = getScoreBgColor(score)
  const icon = dimensionIcons[dimension.dimension] || "📊"
  
  return (
    <div className="flex items-center gap-3">
      <span className="text-base">{icon}</span>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-foreground">{dimension.label}</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">
              {dimension.queriesCount} {dimension.queriesCount === 1 ? "query" : "queries"}
            </span>
            <span className={cn("text-xs font-semibold", color)}>{score}</span>
          </div>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div 
            className={cn("h-full rounded-full transition-all", bgColor)}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>
    </div>
  )
}

// Helper function for pluralization
function pluralize(count: number, singular: string, plural?: string): string {
  if (count === 1) return `${count} ${singular}`
  return `${count} ${plural || singular + "s"}`
}

// Content Status Item Component - shows whether a content type exists
function ContentStatusItem({ label, hasIt }: { label: string; hasIt: boolean }) {
  return (
    <div className={`
      flex items-center gap-2 px-3 py-2 rounded-lg text-xs
      ${hasIt 
        ? "bg-status-success-muted/50 text-status-success" 
        : "bg-muted/50 text-muted-foreground"
      }
    `}>
      {hasIt ? (
        <Check className="size-3.5" />
      ) : (
        <X className="size-3.5" />
      )}
      {label}
    </div>
  )
}

function formatCompetitorName(name: string): string {
  if (!name) return ''
  return name.charAt(0).toUpperCase() + name.slice(1)
}

// Competitor Comparison Component
function CompetitorComparison({ 
  competitors, 
  userStatus, 
  brandName,
  sources,
  category,
  totalQueries,
  visibilityScore
}: { 
  competitors: ScanData["competitors"]
  userStatus: VisibilityStatus
  brandName: string
  sources: ScanData["sources"]
  category: string
  totalQueries: number
  visibilityScore?: number
}) {
  // Calculate user's visibility metrics
  const userMentionCount = sources.filter(s => s.mentioned).length
  const userTopThreeCount = sources.filter(s => s.position === "top-3").length
  const totalSources = sources.length
  
  // Use actual visibility score if provided, otherwise estimate
  const userScore = visibilityScore ?? calculateVisibilityScore(
    userMentionCount * 3,
    userTopThreeCount * 3, 
    6
  )
  
  // For score calculation fallback
  const estimatedTotalQueries = 6

  // Calculate competitor scores and sort by score
  const competitorsWithScores = competitors.map(comp => {
    const totalQueries = comp.totalQueries || estimatedTotalQueries
    const score = calculateVisibilityScore(
      comp.mentionCount || 0,
      comp.topThreeCount || 0,
      totalQueries
    )
    return { ...comp, score }
  }).sort((a, b) => b.score - a.score)

  // Determine if user is winning overall
  const userIsWinning = userStatus === "recommended" || 
    (competitorsWithScores.length > 0 && competitorsWithScores.every(c => !c.outranksUser))
  
  const outrankedBy = competitorsWithScores.filter(c => c.outranksUser)

  // Dynamic section title
  const sectionTitle = userIsWinning 
    ? "How you compare" 
    : outrankedBy.length > 0 
      ? "Who AI recommends more" 
      : "Competitor visibility"

  return (
    <>
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-gray-900">
        {sectionTitle}
      </h2>
          <div className="group relative">
            <Info className="size-4 text-gray-400 cursor-help" />
            <div className="absolute left-0 top-6 z-10 hidden group-hover:block w-64 p-3 bg-popover border border-border rounded-lg shadow-lg text-xs text-gray-500">
              These results show how brands perform for queries in your category. The same brand may show different results in different categories.
            </div>
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Results based on {pluralize(totalQueries, "query", "queries")} in the &quot;{category}&quot; category
        </p>
      </div>

      {competitors.length > 0 ? (
        <div className="space-y-4">
          {/* User's visibility card - always show first */}
          <Card className={cn(
            "border-l-4 border-l-blue-500 bg-blue-50/50",
            userIsWinning ? "border-status-success/30" : ""
          )}>
            <CardContent className="py-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <span className="text-lg font-bold text-primary">
                      {brandName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-foreground">
                        {brandName}
                      </h3>
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                        Your product
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Tested in: &quot;{category}&quot;
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {userIsWinning 
                        ? "Leading in AI recommendations" 
                        : outrankedBy.length > 0 
                          ? `Outranked by ${outrankedBy.map(c => formatCompetitorName(c.name)).join(", ")}`
                          : "Building visibility"
                      }
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn(
                    "text-2xl font-bold",
                    userScore >= 60 ? "text-green-600" :
                    userScore >= 30 ? "text-amber-600" :
                    "text-red-500"
                  )}>
                    {userScore >= 60 ? "High" :
                     userScore >= 30 ? "Moderate" : 
                     userScore > 0 ? "Low" : "None"}
                  </div>
                  <p className="text-xs text-gray-500">
                    Mentioned by {userMentionCount}/{totalSources} sources
                  </p>
                </div>
              </div>
              
              {/* Visual comparison bar */}
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                  <span>AI visibility</span>
                  <span>
                    {userTopThreeCount > 0 
                      ? `Top 3 in ${userTopThreeCount} source${userTopThreeCount > 1 ? "s" : ""}`
                      : userMentionCount > 0 
                        ? "Mentioned but not top 3"
                        : "Not mentioned yet"
                    }
                  </span>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all",
                      userScore >= 60 ? "bg-green-500" :
                      userScore >= 30 ? "bg-amber-500" :
                      "bg-red-500"
                    )}
                    style={{ 
                      width: `${Math.max(userScore, 5)}%` 
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Competitor cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {competitorsWithScores.map((competitor) => {
              const compMentions = competitor.mentionCount || 0
              const compTopThree = competitor.topThreeCount || 0
              const totalQueries = competitor.totalQueries || estimatedTotalQueries
              const mentionPercent = Math.round((compMentions / Math.max(totalQueries * 2, 1)) * 100)
              
              // Determine comparison to user
              const comparisonToUser = competitor.outranksUser 
                ? "outranking" 
                : competitor.visibilityLevel === userStatus 
                  ? "equal" 
                  : competitor.visibilityLevel === "recommended" && userStatus !== "recommended"
                    ? "outranking"
                    : "behind"

              return (
                <Card key={competitor.name} className={cn(
                  competitor.outranksUser && "border-status-warning/30"
                )}>
                  <CardContent className="py-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-foreground">
                            {formatCompetitorName(competitor.name)}
                          </h3>
                          {competitor.isDiscovered && (
                            <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                              Discovered
                            </span>
                          )}
                        </div>
                        <p className="text-xs mt-0.5">
                          {comparisonToUser === "outranking" && (
                            <span className="text-amber-600 font-semibold">More visible than you</span>
                          )}
                          {comparisonToUser === "equal" && <span className="text-gray-500">Similar visibility</span>}
                          {comparisonToUser === "behind" && (
                            <span className="text-green-600 font-medium">Less visible than you</span>
                          )}
                        </p>
                      </div>
                      <StatusIcon
                        status={
                          competitor.visibilityLevel === "recommended"
                            ? "success"
                            : competitor.visibilityLevel === "low-visibility"
                            ? "warning"
                            : "error"
                        }
                      />
                    </div>
                    
                    {/* Category context */}
                    <p className="text-[10px] text-muted-foreground mb-2">
                      In &quot;{category}&quot; queries:
                    </p>
                    
                    {/* Visibility metrics */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Mentions</span>
                        <span className="font-medium text-foreground">
                          {compMentions > 0 ? pluralize(compMentions, "time") : "0"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Top 3</span>
                        <span className="font-medium text-foreground">
                          {compTopThree > 0 ? pluralize(compTopThree, "time") : "0"}
                        </span>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="pt-2">
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full transition-all",
                              competitor.visibilityLevel === "recommended" ? "bg-status-success" :
                              competitor.visibilityLevel === "low-visibility" ? "bg-status-warning" :
                              "bg-muted-foreground/30"
                            )}
                            style={{ width: `${Math.min(mentionPercent, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    
                    {competitor.description && (
                      <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border line-clamp-2">
                        AI says: &quot;{competitor.description}&quot;
                      </p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Summary insight */}
          {competitorsWithScores.length > 0 && (
            <div className={cn(
              "rounded-xl p-4",
              userIsWinning 
                ? "bg-green-50 border border-green-200" 
                : "bg-amber-50 border border-amber-200"
            )}>
              {userIsWinning ? (
                <p className="text-sm text-green-800">
                  <span className="font-semibold">Great position!</span> Your product is recommended more often than 
                  {competitors.length === 1 
                    ? ` ${formatCompetitorName(competitors[0].name)}` 
                    : ` your ${competitors.length} tracked competitors`
                  }. Keep building on this momentum.
                </p>
              ) : outrankedBy.length > 0 ? (
                <p className="text-sm text-amber-800">
                  <span className="font-semibold">{outrankedBy.map(c => formatCompetitorName(c.name)).join(" and ")}</span> 
                  {outrankedBy.length === 1 ? " is " : " are "} 
                  currently recommended more often than your product. 
                  Focus on the action plan below to improve your visibility.
                </p>
              ) : (
                <p className="text-sm text-amber-800">
                  <span className="font-semibold">Room to grow.</span> Build more comparison content and improve your positioning to climb the AI recommendations.
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground mb-2">No competitors tracked yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Add competitors to see how your product compares in AI recommendations.
            </p>
            <Link href="/settings">
              <Button variant="secondary">
                Add competitors to compare
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const { user, loading: authLoading } = useAuth()
  const subscription = useSubscription()
  const [selectedAction, setSelectedAction] = useState<Action | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedContent, setGeneratedContent] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [scanData, setScanData] = useState<ScanData | null>(null)
  const [rawScanData, setRawScanData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasRealData, setHasRealData] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState<"scan" | "generate" | "checklist" | "history" | null>(null)
  const [showScanLimitModal, setShowScanLimitModal] = useState(false)
  const [providerComparisonData, setProviderComparisonData] = useState<unknown>(null)
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurringLoading, setRecurringLoading] = useState(false)
  const [scanDeltas, setScanDeltas] = useState<Record<string, any> | null>(null)
  const [shareOfVoice, setShareOfVoice] = useState<any>(null)
  const [currentScanId, setCurrentScanId] = useState<string | null>(null)

  const [activeActionCategory, setActiveActionCategory] = useState<string>("all")

  // NEW: Content generation state for action items
  const [generatingActionId, setGeneratingActionId] = useState<string | null>(null)
  const [generatedActionContent, setGeneratedActionContent] = useState<{actionId: string; content: string} | null>(null)

  const clearCachedData = () => {
    localStorage.removeItem(SCAN_RESULT_KEY)
    if (user?.id) {
      localStorage.removeItem(`${SCAN_RESULT_KEY}_${user.id}`)
    }
    console.log("[Dashboard] Cache cleared manually")
    window.location.reload()
  }

  // Load scan data: localStorage first (authoritative for current session), DB fallback
  useEffect(() => {
    if (authLoading) return

    let cancelled = false

    const loadData = async () => {
      // STEP 1: Check localStorage FIRST (always has the freshest scan for this session)
      try {
        const userKey = user ? `${SCAN_RESULT_KEY}_${user.id}` : null
        const stored = (userKey && localStorage.getItem(userKey)) || localStorage.getItem(SCAN_RESULT_KEY)

        if (stored) {
          const parsed = JSON.parse(stored)
          console.log("[Dashboard] Found scan in localStorage:", {
            brandName: parsed.brandName,
            status: parsed.status,
            timestamp: parsed.timestamp,
          })

          // If a scan is in progress or failed, don't show stale DB data
          if (parsed.status === "scanning" || parsed.status === "failed") {
            console.log(`[Dashboard] Scan status: ${parsed.status} — not loading stale data`)
            if (cancelled) return
            setHasRealData(false)
            setIsLoading(false)
            return
          }

          if (cancelled) return
          setRawScanData(parsed)
          if (parsed._deltas) setScanDeltas(parsed._deltas)
          if (parsed._share_of_voice) setShareOfVoice(parsed._share_of_voice)
          if (parsed._scanId) setCurrentScanId(parsed._scanId)
          const transformed = transformScanResult(parsed)
          if (transformed) {
            setScanData(transformed)
            setHasRealData(true)
            setIsLoading(false)
            return
          }
        }
      } catch (e) {
        console.error("[Dashboard] Error reading localStorage:", e)
      }

      // STEP 2: Fall back to database (for cross-session, e.g. new browser/device)
      try {
        console.log("[Dashboard] No localStorage data, fetching from database...")
        const response = await fetch("/api/scan-history/latest")

        if (cancelled) return

        if (response.ok) {
          const { scan } = await response.json()
          if (scan?.fullResult) {
            console.log("[Dashboard] Loaded scan from database:", {
              brandName: scan.fullResult.brandName,
              category: scan.fullResult.category,
              score: scan.score,
              scannedAt: scan.scannedAt,
            })

            if (cancelled) return
            setRawScanData(scan.fullResult)
            if (scan.deltas) setScanDeltas(scan.deltas)
            if (scan.shareOfVoice) setShareOfVoice(scan.shareOfVoice)
            if (scan.latestScanId) setCurrentScanId(scan.latestScanId)
            const transformed = transformScanResult(scan.fullResult)
            if (transformed) {
              setScanData(transformed)
              setHasRealData(true)
              setIsLoading(false)
              return
            }
          }
        }
      } catch (e) {
        console.error("[Dashboard] Error fetching from database:", e)
      }

      if (cancelled) return

      // STEP 3: No data anywhere — show empty state
      console.log("[Dashboard] No scan data found anywhere")
      setScanData(mockScanData)
      setHasRealData(false)
      setIsLoading(false)
    }

    loadData()
    return () => { cancelled = true }
  }, [user?.id, authLoading])

  // Use the loaded data or show loading state
  const data = scanData || mockScanData

  // Calculate scan freshness
  const getScanFreshness = () => {
    const scanDate = new Date(data.scanDate)
    const now = new Date()
    const daysDiff = Math.floor((now.getTime() - scanDate.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysDiff < 7) return { status: "fresh", days: daysDiff }
    if (daysDiff < 30) return { status: "aging", days: daysDiff }
    return { status: "stale", days: daysDiff }
  }

  const scanFreshness = getScanFreshness()

  // Determine action type for API
  const getActionType = (action: Action): "comparison" | "faq" | "positioning" => {
    const title = action.title.toLowerCase()
    if (title.includes("comparison") || title.includes("compare")) return "comparison"
    if (title.includes("faq") || title.includes("question")) return "faq"
    return "positioning"
  }

  // Handle generate draft with real API
  const handleGenerateDraft = async (action: Action) => {
    // Check subscription before allowing generation
    if (!subscription.isSubscribed) {
      setShowUpgradeModal("generate")
      return
    }

    setSelectedAction(action)
    setIsGenerating(true)
    setGeneratedContent(null)

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: getActionType(action),
          brandName: data.brand.name,
          competitors: data.competitors.map(c => c.name),
          category: data.brand.category,
          description: rawScanData?.description || `${data.brand.category} tool`,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate content")
      }

      const result = await response.json()
      setGeneratedContent(result.content)
    } catch (error) {
      console.error("Generation error:", error)
      // Fall back to template content
      setGeneratedContent(action.draftContent)
      showToast("Using template content", "info")
    } finally {
      setIsGenerating(false)
    }
  }

  // Handle run new scan with subscription check
  const handleRunNewScan = () => {
    if (!subscription.canScan) {
      // Check if this is a starter user at their limit
      if (subscription.plan === "starter" && subscription.scansRemaining === 0) {
        setShowScanLimitModal(true)
      } else {
        // Free user who used their scan
      setShowUpgradeModal("scan")
      }
      return
    }
    router.push("/check")
  }

  // Handle regenerate
  const handleRegenerate = () => {
    if (selectedAction) {
      handleGenerateDraft(selectedAction)
    }
  }

  // Handle copy to clipboard
  const handleCopy = async () => {
    if (generatedContent) {
      await navigator.clipboard.writeText(generatedContent)
      setCopied(true)
      showToast("Copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Close slide-over
  const handleCloseSlideOver = () => {
    setSelectedAction(null)
    setIsGenerating(false)
    setGeneratedContent(null)
  }

  // NEW: Generate content for action items (gap-based)
  const handleGenerateActionContent = async (actionItem: ActionItem) => {
    if (!subscription.isSubscribed) {
      setShowUpgradeModal("generate")
      return
    }

    setGeneratingActionId(actionItem.id)
    setGeneratedActionContent(null)

    try {
      const response = await fetch("/api/generate-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionItem,
          productData: data.productData || {
            product_name: data.brand.name,
            category: data.brand.category,
            one_line_description: `${data.brand.category} product`,
            target_audience: { who: "businesses", company_size: "various", industry: "general" },
            key_features: [],
            use_cases: [],
            unique_selling_points: [],
          },
          topCompetitors: data.competitors.slice(0, 3).map(c => c.name),
          generateType: actionItem.generate_type,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate content")
      }

      const result = await response.json()
      setGeneratedActionContent({ actionId: actionItem.id, content: result.content })
      showToast("Content generated!", "success")
    } catch (error) {
      console.error("Content generation error:", error)
      showToast("Failed to generate content. Please try again.", "error")
    } finally {
      setGeneratingActionId(null)
    }
  }

  // Copy action content to clipboard
  const handleCopyActionContent = async (content: string) => {
    await navigator.clipboard.writeText(content)
    showToast("Copied to clipboard")
  }

  // Regenerate action content
  const handleRegenerateActionContent = (actionItem: ActionItem) => {
    setGeneratedActionContent(null)
    handleGenerateActionContent(actionItem)
  }

  const handleToggleRecurring = async () => {
    const newValue = !isRecurring
    setRecurringLoading(true)
    try {
      const res = await fetch("/api/scan/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandUrl: data.brand.website, enabled: newValue }),
      })
      if (res.ok) {
        setIsRecurring(newValue)
        showToast(newValue ? "Weekly scans enabled" : "Weekly scans disabled")
      } else {
        showToast("Failed to update recurring setting", "error")
      }
    } catch {
      showToast("Failed to update recurring setting", "error")
    } finally {
      setRecurringLoading(false)
    }
  }

  // Get source icon
  const getSourceIcon = (source: "chatgpt" | "claude") => {
    if (source === "chatgpt") {
      return (
        <div className="size-10 rounded-xl bg-[#10a37f]/10 flex items-center justify-center">
          <span className="text-lg font-bold text-[#10a37f]">G</span>
        </div>
      )
    }
    return (
      <div className="size-10 rounded-xl bg-[#cc785c]/10 flex items-center justify-center">
        <span className="text-lg font-bold text-[#cc785c]">C</span>
      </div>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <SkeletonCard className="h-48" />
          <SkeletonCard className="h-24" />
          <SkeletonCard className="h-32" />
          <SkeletonCard className="h-48" />
        </div>
      </AppShell>
    )
  }

  // No data state — show for new users with no scan results
  if (!hasRealData) {
    return (
      <AppShell>
        <Card>
          <CardContent className="py-16 text-center">
            <div className="size-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
              <Clock className="size-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              No visibility data yet
            </h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Run your first scan to see how AI tools like ChatGPT and Claude perceive your product.
            </p>
            <Link href="/check">
              <Button size="lg">
                Run visibility check
                <ArrowRight className="ml-1 size-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </AppShell>
    )
  }

  // Get accurate status message based on actual mention rate
  const getStatusMessage = () => {
    const mentionRate = data.visibilityScore?.overall || 0
    const score = data.visibilityScore?.breakdown?.mentionRate || mentionRate
    
    if (score === 0 || mentionRate === 0) {
      return {
        title: "AI doesn't know you exist yet",
        subtitle: "You weren't mentioned in any of the queries we tested. Let's change that.",
      }
    }
    
    if (score < 20) {
      return {
        title: "You're barely visible",
        subtitle: "AI tools rarely mention you. There's significant room to improve.",
      }
    }
    
    if (score < 40) {
      return {
      title: "You're on the radar, but not top-of-mind",
        subtitle: "AI tools mention you sometimes, but competitors get recommended more often.",
      }
    }
    
    if (score < 60) {
      return {
        title: "You're in the conversation",
        subtitle: "AI tools recommend you regularly, but you're not consistently in top picks.",
      }
    }
    
    if (score < 80) {
      return {
        title: "You're a top recommendation",
        subtitle: "AI tools frequently recommend you. Focus on maintaining your position.",
      }
    }
    
    return {
      title: "You're dominating AI recommendations",
      subtitle: "AI tools consistently recommend you as a top choice. Keep it up!",
    }
  }

  const statusMessage = getStatusMessage()

  return (
    <AppShell>
      <div className="space-y-8">
        {/* Header with Run New Scan button */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {data.brand.name}
            </h1>
            <p className="text-gray-500 mt-1">
              AI visibility dashboard
            </p>
            
            {/* Free user upgrade prompt - left side */}
            {subscription.plan === "free" && !subscription.canScan && (
              <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl max-w-md">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Lock className="size-5 text-blue-600" />
          </div>
                  <div className="flex-1">
                    <p className="font-semibold text-[#1E293B]">Free scan used</p>
                    <p className="text-sm text-[#64748B] mt-0.5">
                      Upgrade to run more scans and track your visibility over time.
                    </p>
                    <Link href="/pricing">
                      <Button size="sm" className="mt-2 h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white">
                        View Plans
                        <ArrowRight className="size-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            )}
            
            {/* Starter/Pro scans remaining - left side */}
            {subscription.plan !== "free" && (
              <div className="mt-3">
                <ScansRemaining
                  plan={subscription.plan}
                  scansUsed={subscription.scansUsed}
                  scansLimit={subscription.scansLimit}
                  scansRemaining={subscription.scansRemaining}
                  nextResetDate={subscription.nextResetDate}
                />
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/checklist">
              <Button variant="outline" className="relative border-blue-400 hover:border-blue-500 animate-pulse-border">
                <CheckCircle2 className="size-4 mr-2 text-blue-500" />
                Checklist
              </Button>
            </Link>
            <Link href="/progress">
              <Button variant="outline" className="relative border-blue-400 hover:border-blue-500 animate-pulse-border">
                <TrendingUp className="size-4 mr-2 text-blue-500" />
                Track Progress
              </Button>
            </Link>
          <Button variant="secondary" onClick={handleRunNewScan}>
            <RefreshCw className="size-4 mr-2" />
            Run new scan
              {!subscription.canScan && <Lock className="size-3.5 ml-2" />}
          </Button>
          </div>
        </div>

        {/* Stale data warning */}
        {scanFreshness.status === "stale" && (
          <div className="bg-status-warning-muted border border-status-warning/20 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="size-5 text-status-warning shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Your visibility data is {scanFreshness.days} days old
                </p>
                <p className="text-sm text-muted-foreground">
                  AI recommendations change frequently. Run a new scan to see current results.
                  {" "}
                  <button 
                    onClick={clearCachedData}
                    className="text-status-warning underline hover:no-underline"
                  >
                    Clear old data
                  </button>
                </p>
              </div>
            </div>
            <Button size="sm" onClick={handleRunNewScan}>
              Run new scan
              {!subscription.canScan && <Lock className="size-3.5 ml-2" />}
            </Button>
          </div>
        )}

        {/* Aging data prompt */}
        {scanFreshness.status === "aging" && (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Clock className="size-4" />
            <span>Your scan is {scanFreshness.days} days old.</span>
            <button 
              onClick={handleRunNewScan}
              className="text-foreground underline hover:no-underline inline-flex items-center gap-1"
            >
              Run new scan
              {!subscription.canScan && <Lock className="size-3" />}
            </button>
            <span className="text-muted-foreground/50">·</span>
            <button 
              onClick={clearCachedData}
              className="text-muted-foreground hover:text-foreground underline hover:no-underline"
            >
              Clear cache
            </button>
          </div>
        )}

        {/* Section 1: Visibility Status (Hero) */}
        <section>
          <Card className="overflow-hidden">
            <CardContent className="p-8">
              {/* Two-column layout: Status + Score */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Left: Status */}
                <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
                  {/* Use score-derived status for consistency */}
                  <StatusBadge 
                    status={getStatusFromScore(data.visibilityScore?.overall || 0)} 
                    className="text-sm font-bold px-3 py-1 rounded-full" 
                  />
                <p className="mt-3 text-gray-900 font-semibold">
                  {statusMessage.title}
                </p>
                <p className="mt-1 text-sm text-gray-700 leading-relaxed">
                  {statusMessage.subtitle}
                </p>

              {/* Context */}
                  <p className="mt-6 text-sm text-gray-500">
                    When users ask for <span className="font-medium text-gray-900">{data.brand.category}</span>, here&apos;s how AI responds:
                  </p>
                </div>
                
                {/* Right: Visibility Score */}
                {data.visibilityScore && (
                  <VisibilityScoreDisplay score={data.visibilityScore} deltas={scanDeltas} />
                )}
              </div>

              {/* Source Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.sources.map((source) => (
                  <div
                    key={source.source}
                    className={cn(
                      "rounded-xl border border-gray-200 bg-background p-5",
                      source.mentioned ? "border-l-4 border-l-green-500" : "border-l-4 border-l-red-300"
                    )}
                  >
                    {/* Source Header */}
                    <div className="flex items-center gap-3 mb-4">
                      {getSourceIcon(source.source)}
                      <div>
                        <p className="font-medium text-sm text-gray-900">
                          {source.source === "chatgpt" ? "ChatGPT" : "Claude"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {/* Status text MUST match the checkmark */}
                          {source.mentioned && source.position === "top-3" && "Top 3 recommendation"}
                          {source.mentioned && source.position === "mentioned" && "Mentioned"}
                          {source.mentioned && source.position === "not-found" && "Mentioned"} {/* Fix: mentioned=true should say "Mentioned" */}
                          {!source.mentioned && "Not mentioned"}
                        </p>
                      </div>
                      <div className="ml-auto">
                        {source.mentioned ? (
                          <div className="size-6 rounded-full bg-status-success-muted flex items-center justify-center">
                            <Check className="size-3.5 text-status-success" />
                          </div>
                        ) : (
                          <div className="size-6 rounded-full bg-status-error-muted flex items-center justify-center">
                            <X className="size-3.5 text-status-error" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    {source.description && (
                      <div className="space-y-2">
                        <p className="text-sm text-gray-600 italic">
                          &quot;{source.description}&quot;
                        </p>
                        {!source.descriptionAccurate && (
                          <p className="text-xs text-status-warning flex items-center gap-1">
                            <AlertTriangle className="size-3" />
                            This may not match your actual positioning
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Section: Provider Comparison (placeholder) */}
        {data.visibilityScore?.byModel && (
          <section>
            <ProviderComparison data={data.visibilityScore.byModel} totalQueries={data.queries?.length} deltas={scanDeltas} />
          </section>
        )}

        {/* Section: Share of Voice */}
        <section>
          <ShareOfVoice data={shareOfVoice} />
        </section>

        {/* Section: Query Explorer */}
        {currentScanId && (
          <section>
            <QueryExplorer scanId={currentScanId} brandName={data.brand.name} />
          </section>
        )}

        {/* Why Not Mentioned Section - Only show for non-recommended status */}
        {data.status !== "recommended" && data.whyNotMentioned && (
          <section>
            <Card className="border-status-warning/30 bg-status-warning-muted/30">
              <CardContent className="py-5">
                <div className="flex items-start gap-3 mb-4">
                  <div className="size-8 rounded-lg bg-status-warning/10 flex items-center justify-center shrink-0">
                    <AlertTriangle className="size-4 text-status-warning" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">
                      Why AI isn&apos;t recommending you
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Based on our analysis, here&apos;s what might be limiting your visibility
                    </p>
                  </div>
                </div>
                
                {data.whyNotMentioned.reasons.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-foreground mb-2">Likely reasons:</p>
                    <ul className="space-y-1.5">
                      {data.whyNotMentioned.reasons.map((reason, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <X className="size-3.5 text-status-error shrink-0 mt-0.5" />
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {data.whyNotMentioned.suggestions.length > 0 && (
                  <div className="pt-4 border-t border-status-warning/20">
                    <p className="text-xs font-medium text-foreground mb-2">Quick fixes:</p>
                    <ul className="space-y-1.5">
                      {data.whyNotMentioned.suggestions.map((suggestion, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <Check className="size-3.5 text-status-success shrink-0 mt-0.5" />
                          {suggestion}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {/* Content Strategy Recommendations Section */}
        {data.contentStrategy && data.contentStrategy.recommendations.length > 0 && (
          <section>
            <Card>
              <CardContent className="py-5">
                <div className="flex items-start gap-3 mb-4">
                  <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Lightbulb className="size-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">
                      AI Visibility Recommendations
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Based on analysis of {data.contentStrategy.pagesAnalyzed} page{data.contentStrategy.pagesAnalyzed !== 1 ? "s" : ""} on your website
                    </p>
                  </div>
                </div>

                {/* Content Status Overview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <ContentStatusItem 
                    label="Comparison pages" 
                    hasIt={data.contentStrategy.hasComparisonPages} 
                  />
                  <ContentStatusItem 
                    label="FAQ schema" 
                    hasIt={data.contentStrategy.hasFAQSchema} 
                  />
                  <ContentStatusItem 
                    label="Case studies" 
                    hasIt={data.contentStrategy.hasCaseStudies} 
                  />
                  <ContentStatusItem 
                    label="Product schema" 
                    hasIt={data.contentStrategy.hasProductSchema} 
                  />
                </div>

                {/* Recommendations List */}
                <div className="space-y-3 pt-4 border-t border-border">
                  {data.contentStrategy.recommendations
                    .sort((a, b) => {
                      const priorityOrder = { high: 0, medium: 1, low: 2 }
                      return priorityOrder[a.priority] - priorityOrder[b.priority]
                    })
                    .slice(0, 5)
                    .map((rec) => (
                      <div 
                        key={rec.id}
                        className="rounded-lg border border-border bg-muted/30 p-4"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`
                            size-6 rounded-full flex items-center justify-center shrink-0 mt-0.5
                            ${rec.priority === "high" 
                              ? "bg-status-error-muted text-status-error" 
                              : rec.priority === "medium"
                                ? "bg-status-warning-muted text-status-warning"
                                : "bg-muted text-muted-foreground"
                            }
                          `}>
                            {rec.priority === "high" ? (
                              <AlertTriangle className="size-3.5" />
                            ) : rec.priority === "medium" ? (
                              <Target className="size-3.5" />
                            ) : (
                              <Sparkles className="size-3.5" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-foreground text-sm">
                                {rec.title}
                              </h4>
                              <span className={`
                                text-[10px] px-1.5 py-0.5 rounded font-medium
                                ${rec.category === "content" 
                                  ? "bg-blue-500/10 text-blue-500"
                                  : rec.category === "technical"
                                    ? "bg-purple-500/10 text-purple-500"
                                    : rec.category === "authority"
                                      ? "bg-green-500/10 text-green-500"
                                      : "bg-orange-500/10 text-orange-500"
                                }
                              `}>
                                {rec.category}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {rec.description}
                            </p>
                            <div className="bg-background/50 rounded-md p-3 space-y-2">
                              <p className="text-xs">
                                <span className="font-medium text-foreground">Why it matters: </span>
                                <span className="text-muted-foreground">{rec.impact}</span>
                              </p>
                              <p className="text-xs">
                                <span className="font-medium text-foreground">Action: </span>
                                <span className="text-muted-foreground">{rec.action}</span>
                              </p>
                              {rec.example && (
                                <p className="text-xs">
                                  <span className="font-medium text-foreground">Example: </span>
                                  <span className="text-muted-foreground italic">{rec.example}</span>
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>

                {data.contentStrategy.recommendations.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center mt-4">
                    +{data.contentStrategy.recommendations.length - 5} more recommendations
                  </p>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {/* Query Variation Consistency Section - Only show if there are variations */}
        {(() => {
          // Group queries by variation group
          const variationGroups = new Map<string, typeof data.queries>()
          data.queries?.forEach(q => {
            if (q.variationGroup) {
              // Extract base group (e.g., "best_tools" from "best_tools_v1")
              const baseGroup = q.variationGroup.replace(/_v\d+$/, '')
              const existing = variationGroups.get(baseGroup) || []
              variationGroups.set(baseGroup, [...existing, q])
            }
          })
          
          // Only show if we have variation groups with multiple queries
          const groupsWithMultiple = Array.from(variationGroups.entries())
            .filter(([, queries]) => queries.length >= 2)
          
          if (groupsWithMultiple.length === 0) return null
          
          return (
            <section>
              <Card>
                <CardContent className="py-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="size-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                      <RefreshCw className="size-5 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">
                        Query Consistency Analysis
                      </h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Same questions asked in different ways to test AI response consistency
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {groupsWithMultiple.map(([groupName, queries]) => {
                      const mentionedCount = queries.filter(q => q.chatgpt || q.claude).length
                      const totalCount = queries.length
                      const consistencyPercent = Math.round((mentionedCount / totalCount) * 100)
                      
                      const groupLabel = groupName
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, l => l.toUpperCase())
                      
                      return (
                        <div key={groupName} className="rounded-lg border border-border p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-foreground">
                                {groupLabel}
                              </span>
                              <span className={`
                                text-[10px] px-1.5 py-0.5 rounded font-medium
                                ${consistencyPercent >= 80 
                                  ? "bg-status-success-muted text-status-success"
                                  : consistencyPercent >= 50
                                    ? "bg-status-warning-muted text-status-warning"
                                    : "bg-status-error-muted text-status-error"
                                }
                              `}>
                                {consistencyPercent}% consistent
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              Mentioned in {mentionedCount}/{totalCount} variations
                            </span>
                          </div>
                          
                          <div className="space-y-2">
                            {queries.map((q, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm">
                                {q.chatgpt || q.claude ? (
                                  <Check className="size-3.5 text-status-success shrink-0" />
                                ) : (
                                  <X className="size-3.5 text-status-error shrink-0" />
                                )}
                                <span className="text-muted-foreground truncate">
                                  &quot;{q.query}&quot;
                                </span>
                              </div>
                            ))}
                          </div>
                          
                          {consistencyPercent < 100 && consistencyPercent > 0 && (
                            <p className="text-xs text-status-warning mt-3 flex items-center gap-1">
                              <AlertTriangle className="size-3" />
                              Your visibility varies based on how questions are phrased
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  
                  <p className="text-xs text-muted-foreground mt-4 pt-3 border-t border-border">
                    💡 High consistency ({'>'}80%) means AI reliably mentions you. Low consistency suggests your visibility depends on exact wording.
                  </p>
                </CardContent>
              </Card>
            </section>
          )
        })()}

        {/* Section 3: Competitor Comparison */}
        <section>
          <CompetitorComparison 
            competitors={data.competitors}
            userStatus={data.status}
            brandName={data.brand.name}
            sources={data.sources}
            category={data.brand.category}
            totalQueries={data.queries?.length || 5}
            visibilityScore={data.visibilityScore?.overall}
          />
        </section>

        {/* Section 4: Visibility Status - Different content based on score */}
        <section>
          {(() => {
            const score = data.visibilityScore?.overall || 0;
            const isExcellent = score >= 80;
            const isGood = score >= 60 && score < 80;
            
            // For Excellent scores (80%+) - show positive message, hide warnings
            if (isExcellent) {
              return (
                <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="size-12 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="size-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-green-900 dark:text-green-100 text-lg">
                        Your visibility is excellent!
                      </h3>
                      <p className="text-green-700 dark:text-green-300 mt-1">
                        AI tools consistently recommend you as a top choice. 
                        To maintain your position, consider the suggestions in your action plan below.
                      </p>
                    </div>
                  </div>
                </div>
              );
            }
            
            // For Good scores (60-79%) - show encouragement
            if (isGood) {
              return (
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="size-12 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0">
                      <TrendingUp className="size-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-blue-900 dark:text-blue-100 text-lg">
                        You&apos;re doing well!
                      </h3>
                      <p className="text-blue-700 dark:text-blue-300 mt-1">
                        AI tools mention you regularly. Follow the action plan below to reach excellent visibility.
                      </p>
                    </div>
                  </div>
                </div>
              );
            }
            
            // For Moderate/Low scores (<60%) - show warnings
            return (
              <>
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            What&apos;s affecting your visibility
          </h2>

                {/* Show new gap-based analysis if available */}
                {data.visibilityGaps && data.visibilityGaps.length > 0 ? (
                  <div className="space-y-3">
                    {data.visibilityGaps.slice(0, 5).map((gap, index) => (
                      <div key={`gap-${index}`} className="border border-gray-200 rounded-lg p-4 shadow-sm">
                        <div className="flex justify-between items-start">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="size-5 text-amber-500 mt-0.5 shrink-0" />
                            <div>
                              <h4 className="font-semibold text-gray-900">
                                {gap.type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                              </h4>
                              <p className="text-gray-600 text-sm mt-1">
                                {gap.description}
                              </p>
                              {gap.competitor_reference && (
                                <p className="text-gray-500 text-sm mt-2">
                                  {gap.competitor_reference}
                                </p>
                              )}
                            </div>
                          </div>
                          <span className={cn(
                            "text-xs px-2 py-1 rounded font-medium shrink-0 ml-4",
                            gap.impact === "high" 
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" 
                              : gap.impact === "medium" 
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" 
                                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                          )}>
                            {gap.impact === "high" ? "High Impact" : 
                             gap.impact === "medium" ? "Medium Impact" : "Low Impact"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : data.signals.length > 0 ? (
                  /* Fallback to old signals if no gaps */
          <div className="space-y-3">
            {data.signals.map((signal) => (
              <Card key={signal.id}>
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <StatusIcon status={signal.status} withBackground />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-foreground text-sm">
                          {signal.name}
                        </h3>
                        <span className="text-xs text-muted-foreground/70 capitalize">
                          {signal.confidence}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {signal.explanation}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
                ) : (
                  /* Empty state - message depends on score */
                  score >= 75 ? (
                    <div className="text-center py-8 border border-green-200 rounded-lg bg-green-50">
                      <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-3" />
                      <h4 className="text-lg font-semibold text-green-700">Looking good!</h4>
                      <p className="text-gray-500 mt-1">
                        We didn&apos;t find any major visibility issues. Keep up the great work.
                      </p>
                    </div>
                  ) : score >= 40 ? (
                    <div className="py-6 px-5 border border-amber-200 rounded-lg bg-amber-50 flex items-start gap-4">
                      <AlertTriangle className="w-8 h-8 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-lg font-semibold text-amber-700">Room for improvement</h4>
                        <p className="text-amber-700 text-sm mt-1">
                          AI tools mention you sometimes, but you&apos;re not a top recommendation. Follow the action plan below to improve your ranking.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 px-5 border border-red-200 rounded-lg bg-red-50 flex items-start gap-4">
                      <X className="w-8 h-8 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-lg font-semibold text-red-700">Needs attention</h4>
                        <p className="text-red-700 text-sm mt-1">
                          AI tools rarely recommend you. Your competitors are getting the visibility you&apos;re missing. Start with the action plan below.
                        </p>
                      </div>
                    </div>
                  )
                )}
              </>
            );
          })()}
        </section>

        {/* Section 5: Your Action Plan (with Content Generation) */}
        <section>
          <FeatureGate
            allowed={canUseStrategicBrain(subscription.plan || "free")}
            featureName="AI Action Plan"
            requiredPlan="Pro"
          >
          {(() => {
            const score = data.visibilityScore?.overall || 0;
            const isExcellent = score >= 80;
            
            return (
              <>
                <div className="flex items-center gap-2 mb-1">
            <Sparkles className="size-5 text-gray-900" />
            <h2 className="text-xl font-bold text-gray-900">
                    {isExcellent ? "Ways to stay ahead" : "Your action plan"}
            </h2>
          </div>
                <p className="text-gray-500 text-sm mb-6">
                  {isExcellent 
                    ? "You're already doing great. Here are some ideas to maintain your lead:"
                    : "Follow these steps to improve your AI visibility:"}
                </p>
              </>
            );
          })()}

          {/* Show new action items if available */}
          {data.actionItems && data.actionItems.length > 0 ? (() => {
            const hasCategories = data.actionItems.some((a: any) => a.category)
            const filteredActions = activeActionCategory === "all"
              ? data.actionItems
              : data.actionItems.filter((a: any) => a.category === activeActionCategory)

            return (
            <div className="space-y-4">
              {hasCategories && (
                <div className="flex items-center gap-2 mb-4">
                  {["all", "content", "technical", "authority", "positioning"].map(cat => (
                    <button
                      key={cat}
                      onClick={() => setActiveActionCategory(cat)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                        activeActionCategory === cat
                          ? "bg-gray-900 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {cat === "all" ? "All" : cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </button>
                  ))}
                  <span className="text-xs text-gray-500 ml-2">
                    {filteredActions.length} action{filteredActions.length !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
              {filteredActions.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">
                  No {activeActionCategory} actions in this plan
                </p>
              ) : filteredActions.map((actionItem, index) => (
                <div key={actionItem.id || `action-${index}`} className="border border-gray-200 rounded-lg p-5 shadow-sm">
                  <div className="flex items-start gap-4">
                    {/* Number Badge - use index for sequential numbering */}
                    <div className="size-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold shrink-0">
                      #{index + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Header with title and badges */}
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-semibold text-foreground text-lg">
                          {actionItem.title}
                        </h4>
                        <div className="flex items-center gap-2 shrink-0 ml-4">
                          {(actionItem as any).badges?.includes('quick_win') && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">
                              ⚡ Quick Win
                            </span>
                          )}
                          {(actionItem as any).badges?.includes('high_impact') && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                              🎯 High Impact
                            </span>
                          )}
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            actionItem.impact === 'high' 
                              ? 'bg-status-success-muted text-status-success-foreground' 
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {actionItem.impact === 'high' ? 'High impact' : 'Medium'}
                          </span>
                        </div>
                      </div>

                      {/* What we found (evidence from user's site) */}
                      {actionItem.what_we_found && (
                        <div className="mb-3 p-3 bg-muted/30 rounded-lg border-l-2 border-status-warning">
                          <p className="text-sm font-medium text-foreground mb-1">What we found:</p>
                          <p className="text-sm text-gray-600">{actionItem.what_we_found}</p>
                        </div>
                      )}

                      {/* Competitor comparison */}
                      {actionItem.competitor_comparison && (
                        <div className="mb-3 p-3 bg-muted/30 rounded-lg border-l-2 border-primary">
                          <p className="text-sm font-medium text-foreground mb-1">Competitor comparison:</p>
                          <p className="text-sm text-gray-600">{actionItem.competitor_comparison}</p>
                        </div>
                      )}

                      {/* Why it matters */}
                      {actionItem.why_it_matters && (
                        <p className="text-gray-600 text-sm mb-3">
                          <span className="font-medium text-gray-900">Why it matters:</span> {actionItem.why_it_matters}
                        </p>
                      )}

                      {/* Competitor example (legacy support) */}
                      {actionItem.competitor_example && !actionItem.competitor_comparison && (
                        <p className="text-gray-500 text-sm mt-2 italic">
                          {actionItem.competitor_example}
                        </p>
                      )}

                      {/* Scored metadata (new action plans) */}
                      {(actionItem as any).impact_score && (
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span>Impact: <strong className="text-gray-700">{(actionItem as any).impact_score}/10</strong></span>
                          <span>Effort: <strong className="text-gray-700">{(actionItem as any).effort_score}/10</strong></span>
                        </div>
                      )}
                      {((actionItem as any).category || (actionItem as any).timeline) && (
                        <div className="flex items-center gap-2 mt-2">
                          {(actionItem as any).category && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              (actionItem as any).category === 'content' ? 'bg-blue-100 text-blue-700' :
                              (actionItem as any).category === 'technical' ? 'bg-purple-100 text-purple-700' :
                              (actionItem as any).category === 'authority' ? 'bg-green-100 text-green-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>
                              {(actionItem as any).category}
                            </span>
                          )}
                          {(actionItem as any).timeline && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                              {(actionItem as any).timeline.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Generate Button */}
                      {actionItem.generate_type && (
                        <Button
                          size="sm"
                          onClick={() => handleGenerateActionContent(actionItem)}
                          disabled={generatingActionId === actionItem.id}
                          className="mt-4"
                          variant={subscription.isSubscribed ? "default" : "secondary"}
                        >
                          {generatingActionId === actionItem.id ? (
                            <>
                              <Loader2 className="size-4 mr-2 animate-spin" />
                              Generating...
                            </>
                          ) : subscription.isSubscribed ? (
                            <>
                              <Sparkles className="size-4 mr-2" />
                              Generate draft
                            </>
                          ) : (
                            <>
                              <Lock className="size-4 mr-2" />
                              Generate draft
                              <span className="ml-1.5 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                                Pro
                              </span>
                            </>
                          )}
                        </Button>
                      )}

                      {/* Generated Content Display */}
                      {generatedActionContent?.actionId === actionItem.id && (
                        <div className="mt-4 p-4 bg-muted/50 rounded-lg border border-border animate-fade-in">
                          <div className="flex justify-between items-center mb-3">
                            <h5 className="font-medium text-foreground">Generated Draft</h5>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleCopyActionContent(generatedActionContent.content)}
                                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                              >
                                <Copy className="size-4" />
                                Copy
                              </button>
                              <button
                                onClick={() => handleRegenerateActionContent(actionItem)}
                                className="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
                              >
                                <RefreshCw className="size-4" />
                                Regenerate
                              </button>
                            </div>
                          </div>
                          <div className="prose prose-sm max-w-none dark:prose-invert">
                            <ReactMarkdown>{generatedActionContent.content}</ReactMarkdown>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )
          })() : (
            /* Fallback to old actions if no action items */
          <div className="space-y-4">
            {data.actions.map((action, index) => (
              <Card key={`${action.id}-${index}`} className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                      {/* Priority Badge - use index for sequential numbering */}
                    <div className="size-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold shrink-0">
                        #{index + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Title */}
                      <h3 className="font-semibold text-foreground mb-2">
                        {action.title}
                      </h3>

                      {/* Why */}
                      <p className="text-sm text-gray-600 mb-3">
                        {action.why}
                      </p>

                      {/* What */}
                      <p className="text-sm text-gray-700 mb-4">
                        {action.what}
                      </p>

                      {/* Generate Button */}
                      <Button
                        size="sm"
                        onClick={() => handleGenerateDraft(action)}
                          variant={subscription.isSubscribed ? "default" : "secondary"}
                      >
                          {subscription.isSubscribed ? (
                          <Sparkles className="size-3.5 mr-1.5" />
                        ) : (
                          <Lock className="size-3.5 mr-1.5" />
                        )}
                        Generate draft
                          {!subscription.isSubscribed && (
                          <span className="ml-1.5 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                            Pro
                          </span>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          )}
          </FeatureGate>
        </section>

        {/* Section 6: Scan Footer */}
        <section className="pt-6 border-t border-border">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span>Last scan: {formatScanDate(data.scanDate)}</span>
              <span className="hidden sm:inline">•</span>
              <span>Sources: ChatGPT, Claude</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleToggleRecurring}
                disabled={recurringLoading}
                className="flex items-center gap-2 text-xs"
              >
                <div className={cn(
                  "relative w-8 h-[18px] rounded-full transition-colors",
                  isRecurring ? "bg-primary" : "bg-muted-foreground/30"
                )}>
                  <div className={cn(
                    "absolute top-[2px] size-[14px] rounded-full bg-white transition-transform shadow-sm",
                    isRecurring ? "translate-x-[15px]" : "translate-x-[2px]"
                  )} />
                </div>
                <span className={cn(
                  "transition-colors",
                  isRecurring ? "text-foreground" : "text-muted-foreground"
                )}>
                  Run weekly
                </span>
              </button>
              <button
                onClick={handleRunNewScan}
                className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1.5"
              >
                <RefreshCw className="size-3.5" />
                Run new scan
                {!subscription.canScan && <Lock className="size-3 ml-1" />}
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <UpgradePrompt
          feature={showUpgradeModal}
          onClose={() => setShowUpgradeModal(null)}
        />
      )}

      {/* Scan Limit Modal (for Starter users) */}
      <ScanLimitModal
        isOpen={showScanLimitModal}
        onClose={() => setShowScanLimitModal(false)}
        scansUsed={subscription.scansUsed}
        scansLimit={subscription.scansLimit || 10}
        resetDate={subscription.nextResetDate}
      />

      {/* Slide-over Panel for Generated Drafts */}
      <SlideOver
        open={selectedAction !== null}
        onClose={handleCloseSlideOver}
        title={selectedAction?.title || ""}
      >
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="size-8 text-muted-foreground animate-spin mb-4" />
            <p className="text-muted-foreground">Generating your draft...</p>
          </div>
        ) : generatedContent ? (
          <div className="space-y-6">
            {/* Action Buttons */}
            <div className="flex justify-between items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRegenerate}
                className="gap-1.5"
              >
                <RotateCw className="size-3.5" />
                Regenerate
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopy}
                className="gap-1.5"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="size-3.5" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" />
                    Copy to clipboard
                  </>
                )}
              </Button>
            </div>

            {/* Generated Content */}
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap text-sm text-foreground bg-muted rounded-xl p-4 overflow-x-auto font-sans leading-relaxed">
                {generatedContent}
              </pre>
            </div>
          </div>
        ) : null}
      </SlideOver>
    </AppShell>
  )
}
