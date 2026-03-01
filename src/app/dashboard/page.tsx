"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { SlideOver } from "@/components/ui/slide-over"
import { SkeletonCard } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/toast"
import { useAuth } from "@/lib/auth"
import { useSubscription } from "@/lib/subscription"
import { UpgradePrompt } from "@/components/upgrade-prompt"
import { ScansRemaining } from "@/components/scans-remaining"
import { ScanLimitModal } from "@/components/upgrade-modal"
import { 
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
  if (score >= 75) return "Excellent"
  if (score >= 50) return "Moderate"
  if (score >= 25) return "Low"
  return "Very Low"
}

// Get score color
function getScoreColor(score: number): string {
  if (score >= 70) return "text-green-600"
  if (score >= 40) return "text-amber-500"
  return "text-red-500"
}

// Get score hex color for inline styles
function getScoreHex(score: number): string {
  if (score >= 70) return "#16a34a"
  if (score >= 40) return "#f59e0b"
  return "#ef4444"
}

// Get score background color
function getScoreBgColor(score: number): string {
  if (score >= 70) return "bg-green-500"
  if (score >= 40) return "bg-amber-400"
  return "bg-red-500"
}

// Get status badge info
function getStatusBadgeInfo(score: number): { label: string; classes: string } {
  if (score >= 75) return { label: "Excellent", classes: "bg-green-100 text-green-700 border border-green-200" }
  if (score >= 50) return { label: "Moderate", classes: "bg-amber-100 text-amber-700 border border-amber-200" }
  if (score >= 25) return { label: "Low", classes: "bg-orange-100 text-orange-700 border border-orange-200" }
  return { label: "Very Low", classes: "bg-red-100 text-red-700 border border-red-200" }
}

// Capitalize competitor name
function formatCompetitorName(name: string): string {
  if (!name) return ""
  return name.charAt(0).toUpperCase() + name.slice(1)
}

// Category color for action tags
function getCategoryColor(category: string): string {
  switch (category) {
    case "content": return "bg-blue-100 text-blue-700"
    case "technical": return "bg-purple-100 text-purple-700"
    case "authority": return "bg-green-100 text-green-700"
    case "positioning": return "bg-amber-100 text-amber-700"
    default: return "bg-gray-100 text-gray-600"
  }
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

// Visibility Score Display Component — now used inline in the hero
function VisibilityScoreDisplay({ score, deltas }: { score: VisibilityScore; deltas?: Record<string, any> | null }) {
  const overallScore = score.overall
  
  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Mention Rate</div>
        <div className="flex items-center gap-2 mt-1">
          <div className="text-2xl font-bold text-gray-900">{score.breakdown.mentionRate}%</div>
          {deltas?.mention_rate?.delta != null && (
            <ScoreDelta delta={deltas.mention_rate.delta * 100} suffix="%" />
          )}
        </div>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Top 3 Rate</div>
        <div className="text-2xl font-bold text-gray-900 mt-1">{score.breakdown.topThreeRate}%</div>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Avg. Position</div>
        <div className="text-2xl font-bold text-gray-900 mt-1">
          {score.breakdown.avgPosition !== null ? `#${score.breakdown.avgPosition}` : "N/A"}
        </div>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Model Agreement</div>
        <div className="flex items-center gap-2 mt-1">
          <div className="text-2xl font-bold text-gray-900">{score.breakdown.modelConsistency}%</div>
          {deltas?.consistency?.delta != null && (
            <ScoreDelta delta={deltas.consistency.delta} suffix="%" />
          )}
        </div>
      </div>
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
      <h2 className="text-lg font-bold text-gray-900">Who AI Recommends Instead</h2>
      <p className="text-sm text-gray-500 mt-1 mb-4">
        Based on {pluralize(totalQueries, "query", "queries")} in the &quot;{category}&quot; category
      </p>

      {competitors.length > 0 ? (
        <div className="space-y-4">
          {/* Your product card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 border-l-4 border-l-blue-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <span className="text-lg font-bold text-blue-700">
                    {brandName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{brandName}</span>
                    <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-semibold">Your product</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={cn("text-lg font-bold", getScoreColor(userScore))}>
                  {userScore >= 60 ? "High" : userScore >= 30 ? "Moderate" : userScore > 0 ? "Low" : "None"}
                </div>
                <div className="text-xs text-gray-400">Mentioned by {userMentionCount}/{totalSources} sources</div>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                <span>AI visibility</span>
                <span>
                  {userTopThreeCount > 0 
                    ? `Top 3 in ${userTopThreeCount} source${userTopThreeCount > 1 ? "s" : ""}`
                    : userMentionCount > 0 ? "Mentioned but not top 3" : "Not mentioned yet"}
                </span>
              </div>
              <div className="w-full h-2.5 bg-gray-100 rounded-full">
                <div className="h-2.5 rounded-full transition-all" style={{ width: `${Math.max(userScore, 3)}%`, backgroundColor: getScoreHex(userScore) }} />
              </div>
            </div>
          </div>

          {/* Top competitor card */}
          {competitorsWithScores.filter(c => c.outranksUser).slice(0, 1).map((competitor) => {
            const compMentions = competitor.mentionCount || 0
            const compTopThree = competitor.topThreeCount || 0
            const cTotalQueries = competitor.totalQueries || estimatedTotalQueries
            const competitorPct = Math.round((compMentions / Math.max(cTotalQueries, 1)) * 100)
            return (
              <div key={competitor.name} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 border-l-4 border-l-amber-400">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-amber-100 flex items-center justify-center">
                      <span className="text-lg font-bold text-amber-700">
                        {formatCompetitorName(competitor.name).charAt(0)}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{formatCompetitorName(competitor.name)}</span>
                        <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-semibold">More visible than you</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-green-500">&#10003;</span>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                  <div>
                    <span className="text-gray-500">Mentions</span>
                    <span className="float-right font-bold text-gray-900">{compMentions > 0 ? pluralize(compMentions, "time") : "0"}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Top 3</span>
                    <span className="float-right font-bold text-gray-900">{compTopThree > 0 ? pluralize(compTopThree, "time") : "0"}</span>
                  </div>
                </div>
                <div className="w-full h-2.5 bg-gray-100 rounded-full mt-3">
                  <div className="h-2.5 bg-green-500 rounded-full" style={{ width: `${Math.min(competitorPct, 100)}%` }} />
                </div>
              </div>
            )
          })}

          {/* Additional competitor cards in a grid */}
          {competitorsWithScores.filter(c => !c.outranksUser || competitorsWithScores.filter(cc => cc.outranksUser).indexOf(c) > 0).length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {competitorsWithScores.filter(c => {
                const outrankers = competitorsWithScores.filter(cc => cc.outranksUser)
                return !(c.outranksUser && outrankers.indexOf(c) === 0)
              }).map((competitor) => {
                const compMentions = competitor.mentionCount || 0
                const compTopThree = competitor.topThreeCount || 0
                const cTotalQueries = competitor.totalQueries || estimatedTotalQueries
                const mentionPercent = Math.round((compMentions / Math.max(cTotalQueries * 2, 1)) * 100)
                const comparisonToUser = competitor.outranksUser ? "outranking" : "behind"
                return (
                  <div key={competitor.name} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{formatCompetitorName(competitor.name)}</h3>
                        <p className="text-xs mt-0.5">
                          {comparisonToUser === "outranking" ? (
                            <span className="text-amber-600 font-semibold">More visible than you</span>
                          ) : (
                            <span className="text-green-600 font-medium">Less visible than you</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between"><span className="text-gray-500">Mentions</span><span className="font-bold text-gray-900">{compMentions > 0 ? pluralize(compMentions, "time") : "0"}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Top 3</span><span className="font-bold text-gray-900">{compTopThree > 0 ? pluralize(compTopThree, "time") : "0"}</span></div>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full mt-3">
                      <div className={cn("h-1.5 rounded-full", competitor.outranksUser ? "bg-amber-400" : "bg-gray-300")} style={{ width: `${Math.min(mentionPercent, 100)}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Insight bar */}
          {outrankedBy.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-800">
                <strong>{formatCompetitorName(outrankedBy[0].name)}</strong> is recommended more often than your product. Focus on the action plan below to close the gap.
              </p>
            </div>
          )}
          {userIsWinning && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-sm text-green-800">
                <strong>Great position!</strong> Your product is recommended more often than{" "}
                {competitors.length === 1 ? formatCompetitorName(competitors[0].name) : `your ${competitors.length} tracked competitors`}. Keep building on this momentum.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <p className="text-gray-500 mb-2">No competitors tracked yet</p>
          <p className="text-sm text-gray-400 mb-4">
            Add competitors to see how your product compares in AI recommendations.
          </p>
          <Link href="/settings">
            <Button variant="secondary">Add competitors to compare</Button>
          </Link>
        </div>
      )}
    </>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const { user, loading: authLoading } = useAuth()
  const subscription = useSubscription()
  // Old queries section state removed — QueryExplorer component handles this now
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

  const score = data.visibilityScore?.overall || 0
  const scoreHex = getScoreHex(score)
  const statusBadge = getStatusBadgeInfo(score)
  const mentionRate = data.visibilityScore?.breakdown?.mentionRate || 0
  const top3Rate = data.visibilityScore?.breakdown?.topThreeRate || 0
  const avgPosition = data.visibilityScore?.breakdown?.avgPosition
  const modelAgreement = data.visibilityScore?.breakdown?.modelConsistency || 0

  return (
    <AppShell>
      <div className="bg-gray-50 min-h-screen -mx-4 sm:-mx-6 -mt-6 -mb-6 px-4 sm:px-6 py-8">
        <div className="max-w-5xl mx-auto space-y-8">

        {/* Stale data warning */}
        {scanFreshness.status === "stale" && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="size-5 text-amber-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Your visibility data is {scanFreshness.days} days old
                </p>
                <p className="text-sm text-gray-500">
                  AI recommendations change frequently. Run a new scan to see current results.{" "}
                  <button onClick={clearCachedData} className="text-amber-600 underline hover:no-underline">Clear old data</button>
                </p>
              </div>
            </div>
            <Button size="sm" onClick={handleRunNewScan} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
              Run new scan
              {!subscription.canScan && <Lock className="size-3.5 ml-2" />}
            </Button>
          </div>
        )}

        {scanFreshness.status === "aging" && (
          <div className="text-sm text-gray-500 flex items-center gap-2">
            <Clock className="size-4" />
            <span>Your scan is {scanFreshness.days} days old.</span>
            <button onClick={handleRunNewScan} className="text-gray-900 underline hover:no-underline inline-flex items-center gap-1">
              Run new scan{!subscription.canScan && <Lock className="size-3" />}
            </button>
            <span className="text-gray-300">·</span>
            <button onClick={clearCachedData} className="text-gray-400 hover:text-gray-600 underline hover:no-underline">Clear cache</button>
          </div>
        )}

        {/* ================================================================ */}
        {/* SECTION 1: HERO SUMMARY                                          */}
        {/* ================================================================ */}
        <section>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
            {/* Header row */}
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{data.brand.name}</h1>
                <p className="text-sm text-gray-500 mt-0.5">AI visibility dashboard</p>
                {subscription.plan !== "free" && (
                  <div className="mt-2">
                    <ScansRemaining
                      plan={subscription.plan}
                      scansUsed={subscription.scansUsed}
                      scansLimit={subscription.scansLimit}
                      scansRemaining={subscription.scansRemaining}
                      nextResetDate={subscription.nextResetDate}
                    />
                  </div>
                )}
                {subscription.plan === "free" && !subscription.canScan && (
                  <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-full">
                    <Lock className="size-3 text-blue-600" />
                    <span className="text-xs text-blue-600 font-medium">Free scan used</span>
                    <Link href="/pricing" className="text-xs text-blue-700 font-semibold underline hover:no-underline">Upgrade</Link>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Link href="/checklist">
                  <button className="bg-white border border-gray-200 text-gray-700 font-medium px-4 py-2 rounded-xl hover:bg-gray-50 transition text-sm inline-flex items-center gap-1.5">
                    <CheckCircle2 className="size-4 text-blue-500" />
                    Checklist
                  </button>
                </Link>
                <Link href="/progress">
                  <button className="bg-white border border-gray-200 text-gray-700 font-medium px-4 py-2 rounded-xl hover:bg-gray-50 transition text-sm inline-flex items-center gap-1.5">
                    <TrendingUp className="size-4 text-blue-500" />
                    Track Progress
                  </button>
                </Link>
                <button
                  onClick={handleRunNewScan}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl shadow-sm transition text-sm inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="size-4" />
                  Run new scan
                  {!subscription.canScan && <Lock className="size-3.5 ml-1" />}
                </button>
              </div>
            </div>

            {/* Score area */}
            <div className="mt-8 flex flex-col lg:flex-row items-start gap-12">
              {/* Score block */}
              <div className="shrink-0">
                <div className="flex items-end gap-2">
                  <span className="text-7xl font-extrabold leading-none" style={{ color: scoreHex }}>{score}</span>
                  <span className="text-2xl text-gray-300 font-medium mb-2">/100</span>
                </div>
                <div className="mt-3">
                  <span className={cn("inline-block text-xs font-bold px-3 py-1 rounded-full", statusBadge.classes)}>
                    {statusBadge.label}
                  </span>
                </div>
                {scanDeltas?.overall?.delta != null && (
                  <div className="mt-2">
                    <ScoreDelta delta={scanDeltas.overall.delta} suffix=" pts" size="md" />
                  </div>
                )}
                <p className="mt-3 text-sm text-gray-600 leading-relaxed max-w-xs">
                  {statusMessage.subtitle}
                </p>
              </div>

              {/* Metrics grid */}
              <div className="flex-1 w-full">
                {data.visibilityScore && (
                  <VisibilityScoreDisplay score={data.visibilityScore} deltas={scanDeltas} />
                )}
              </div>
            </div>

            {/* Score progress bar */}
            <div className="w-full h-3 bg-gray-100 rounded-full mt-6">
              <div
                className="h-3 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(score, 1)}%`, backgroundColor: scoreHex }}
              />
            </div>

            {/* Insight line */}
            <div className="mt-6 pt-6 border-t border-gray-100">
              <p className="text-sm text-gray-600">
                When users ask for <strong>{data.brand.category}</strong>, here&apos;s how AI responds:
              </p>
            </div>

            {/* Provider summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {data.sources.map((source) => {
                const isGPT = source.source === "chatgpt"
                const providerLabel = isGPT ? "ChatGPT" : "Claude"
                const bgHex = isGPT ? "#10A37F" : "#D4A574"
                const iconChar = isGPT ? "G" : "C"
                const totalQ = data.queries?.length || 0
                const mentionedQ = data.queries?.filter(q => isGPT ? q.chatgpt : q.claude).length || 0
                return (
                  <div
                    key={source.source}
                    className={cn(
                      "bg-white rounded-xl border border-gray-200 p-4",
                      source.mentioned ? "border-l-4 border-l-green-500" : "border-l-4 border-l-red-300"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: bgHex }}>
                        {iconChar}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 text-sm">{providerLabel}</p>
                        <p className="text-xs text-gray-500">
                          {source.mentioned && source.position === "top-3" && <span className="text-green-600">Top 3 recommendation</span>}
                          {source.mentioned && source.position !== "top-3" && <span className="text-green-600">Mentioned</span>}
                          {!source.mentioned && <span className="text-red-500">Not mentioned</span>}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400">{mentionedQ} of {totalQ} queries</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* SECTION 2: AI PROVIDER COMPARISON                                */}
        {/* ================================================================ */}
        {data.visibilityScore?.byModel && (
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Score by AI Provider</h2>
            <ProviderComparison data={data.visibilityScore.byModel} totalQueries={data.queries?.length} deltas={scanDeltas} />
          </section>
        )}

        {/* Share of Voice — hidden when no data */}
        {shareOfVoice && shareOfVoice.brands && shareOfVoice.brands.length > 0 && (
          <section>
            <ShareOfVoice data={shareOfVoice} />
          </section>
        )}

        {/* ================================================================ */}
        {/* SECTION 3: COMPETITIVE POSITION                                  */}
        {/* ================================================================ */}
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

        {/* ================================================================ */}
        {/* SECTION 4: WHAT'S AFFECTING YOUR VISIBILITY                      */}
        {/* ================================================================ */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">What&apos;s Affecting Your Visibility</h2>

          {score >= 75 ? (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
              <div className="text-3xl mb-3">&#9989;</div>
              <h3 className="text-lg font-bold text-green-800">Looking good!</h3>
              <p className="text-sm text-green-700 mt-1">
                AI tools recommend you frequently. Keep up the great work.
              </p>
            </div>
          ) : score >= 40 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="text-xl">&#9888;&#65039;</div>
                <h3 className="font-bold text-amber-800">Room for improvement</h3>
              </div>
              <p className="text-sm text-amber-700 mb-4">
                AI tools mention you sometimes, but you&apos;re not a top recommendation yet.
              </p>
              {/* Issue cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                {mentionRate < 10 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start gap-3"><div className="text-lg mt-0.5">&#128200;</div><div><div className="font-semibold text-gray-900 text-sm">Low mention frequency</div><div className="text-xs text-gray-500 mt-1">AI mentions you in less than 10% of relevant queries.</div></div></div>
                  </div>
                )}
                {top3Rate === 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start gap-3"><div className="text-lg mt-0.5">&#127942;</div><div><div className="font-semibold text-gray-900 text-sm">No top 3 placements</div><div className="text-xs text-gray-500 mt-1">You&apos;re never ranked in the top 3 recommendations.</div></div></div>
                  </div>
                )}
                {modelAgreement < 50 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start gap-3"><div className="text-lg mt-0.5">&#129302;</div><div><div className="font-semibold text-gray-900 text-sm">Low model agreement</div><div className="text-xs text-gray-500 mt-1">AI providers disagree about your product. Only some mention you.</div></div></div>
                  </div>
                )}
                {(!avgPosition || avgPosition > 5) && (
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start gap-3"><div className="text-lg mt-0.5">&#128202;</div><div><div className="font-semibold text-gray-900 text-sm">Poor ranking position</div><div className="text-xs text-gray-500 mt-1">When mentioned, you appear far down the recommendation list.</div></div></div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="text-xl">&#128308;</div>
                <h3 className="font-bold text-red-800">Needs attention</h3>
              </div>
              <p className="text-sm text-red-700 mb-4">
                AI tools rarely recommend you. Your competitors are getting the visibility you&apos;re missing.
              </p>
              {/* Issue cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                {mentionRate < 10 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start gap-3"><div className="text-lg mt-0.5">&#128200;</div><div><div className="font-semibold text-gray-900 text-sm">Low mention frequency</div><div className="text-xs text-gray-500 mt-1">AI mentions you in less than 10% of relevant queries.</div></div></div>
                  </div>
                )}
                {top3Rate === 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start gap-3"><div className="text-lg mt-0.5">&#127942;</div><div><div className="font-semibold text-gray-900 text-sm">No top 3 placements</div><div className="text-xs text-gray-500 mt-1">You&apos;re never ranked in the top 3 recommendations.</div></div></div>
                  </div>
                )}
                {modelAgreement < 50 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start gap-3"><div className="text-lg mt-0.5">&#129302;</div><div><div className="font-semibold text-gray-900 text-sm">Low model agreement</div><div className="text-xs text-gray-500 mt-1">AI providers disagree about your product. Only some mention you.</div></div></div>
                  </div>
                )}
                {(!avgPosition || avgPosition > 5) && (
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start gap-3"><div className="text-lg mt-0.5">&#128202;</div><div><div className="font-semibold text-gray-900 text-sm">Poor ranking position</div><div className="text-xs text-gray-500 mt-1">When mentioned, you appear far down the recommendation list.</div></div></div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Show gap-based analysis below the status card if available and score < 75 */}
          {score < 75 && data.visibilityGaps && data.visibilityGaps.length > 0 && (
            <div className="space-y-3 mt-4">
              {data.visibilityGaps.slice(0, 5).map((gap, index) => (
                <div key={`gap-${index}`} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="size-5 text-amber-500 mt-0.5 shrink-0" />
                      <div>
                        <h4 className="font-semibold text-gray-900 text-sm">
                          {gap.type.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </h4>
                        <p className="text-gray-600 text-sm mt-1">{gap.description}</p>
                        {gap.competitor_reference && <p className="text-gray-500 text-xs mt-2">{gap.competitor_reference}</p>}
                      </div>
                    </div>
                    <span className={cn(
                      "text-xs px-2 py-1 rounded-full font-medium shrink-0 ml-4",
                      gap.impact === "high" ? "bg-red-100 text-red-700" :
                      gap.impact === "medium" ? "bg-amber-100 text-amber-700" :
                      "bg-gray-100 text-gray-600"
                    )}>
                      {gap.impact === "high" ? "High Impact" : gap.impact === "medium" ? "Medium Impact" : "Low Impact"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ================================================================ */}
        {/* SECTION 5: YOUR ACTION PLAN                                      */}
        {/* ================================================================ */}
        <section>
          <FeatureGate
            allowed={canUseStrategicBrain(subscription.plan || "free")}
            featureName="AI Action Plan"
            requiredPlan="Pro"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Sparkles className="size-5" />
                  {score >= 80 ? "Ways to stay ahead" : "Your Action Plan"}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {score >= 80
                    ? "You're already doing great. Here are some ideas to maintain your lead:"
                    : "Follow these steps to improve your AI visibility"}
                </p>
              </div>
            </div>

            {data.actionItems && data.actionItems.length > 0 ? (() => {
              const hasCategories = data.actionItems.some((a: any) => a.category)
              const filteredActions = activeActionCategory === "all"
                ? data.actionItems
                : data.actionItems.filter((a: any) => a.category === activeActionCategory)

              return (
                <div className="space-y-3">
                  {hasCategories && (
                    <div className="flex items-center gap-2 mb-4">
                      {["all", "content", "technical", "authority", "positioning"].map(cat => (
                        <button
                          key={cat}
                          onClick={() => setActiveActionCategory(cat)}
                          className={cn(
                            "text-xs px-3 py-1.5 rounded-lg font-medium transition",
                            activeActionCategory === cat ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                          )}
                        >
                          {cat === "all" ? "All" : cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </button>
                      ))}
                      <span className="text-xs text-gray-400 ml-2">
                        {filteredActions.length} action{filteredActions.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  )}
                  {filteredActions.length === 0 ? (
                    <p className="text-sm text-gray-500 py-4 text-center">No {activeActionCategory} actions in this plan</p>
                  ) : filteredActions.map((actionItem, index) => (
                    <div key={actionItem.id || `action-${index}`} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:border-gray-300 transition">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900 text-sm">{actionItem.title}</h3>
                            {(actionItem as any).badges?.includes('quick_win') && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-green-100 text-green-700">&#9889; Quick Win</span>
                            )}
                            {(actionItem as any).badges?.includes('high_impact') && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-700">&#127919; High Impact</span>
                            )}
                          </div>

                          {actionItem.what_we_found && (
                            <div className="mt-2 p-3 bg-gray-50 rounded-lg border-l-2 border-amber-400">
                              <p className="text-sm text-gray-600">{actionItem.what_we_found}</p>
                            </div>
                          )}
                          {actionItem.competitor_comparison && (
                            <div className="mt-2 p-3 bg-gray-50 rounded-lg border-l-2 border-blue-400">
                              <p className="text-sm text-gray-600">{actionItem.competitor_comparison}</p>
                            </div>
                          )}
                          {actionItem.why_it_matters && (
                            <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">{actionItem.why_it_matters}</p>
                          )}
                          {actionItem.competitor_example && !actionItem.competitor_comparison && (
                            <p className="text-sm text-gray-400 mt-1 italic">{actionItem.competitor_example}</p>
                          )}

                          {(actionItem as any).impact_score && (
                            <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                              <span>Impact: <strong className="text-gray-600">{(actionItem as any).impact_score}/10</strong></span>
                              <span>Effort: <strong className="text-gray-600">{(actionItem as any).effort_score}/10</strong></span>
                              {(actionItem as any).category && (
                                <span className={cn("px-2 py-0.5 rounded-full font-medium", getCategoryColor((actionItem as any).category))}>
                                  {(actionItem as any).category}
                                </span>
                              )}
                            </div>
                          )}
                          {!(actionItem as any).impact_score && ((actionItem as any).category || (actionItem as any).timeline) && (
                            <div className="flex items-center gap-2 mt-2">
                              {(actionItem as any).category && (
                                <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", getCategoryColor((actionItem as any).category))}>
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

                          {actionItem.generate_type && (
                            <Button
                              size="sm"
                              onClick={() => handleGenerateActionContent(actionItem)}
                              disabled={generatingActionId === actionItem.id}
                              className="mt-4"
                              variant={subscription.isSubscribed ? "default" : "secondary"}
                            >
                              {generatingActionId === actionItem.id ? (
                                <><Loader2 className="size-4 mr-2 animate-spin" />Generating...</>
                              ) : subscription.isSubscribed ? (
                                <><Sparkles className="size-4 mr-2" />Generate draft</>
                              ) : (
                                <><Lock className="size-4 mr-2" />Generate draft<span className="ml-1.5 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">Pro</span></>
                              )}
                            </Button>
                          )}

                          {generatedActionContent?.actionId === actionItem.id && (
                            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 animate-fade-in">
                              <div className="flex justify-between items-center mb-3">
                                <h5 className="font-medium text-gray-900 text-sm">Generated Draft</h5>
                                <div className="flex gap-2">
                                  <button onClick={() => handleCopyActionContent(generatedActionContent.content)} className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1"><Copy className="size-4" />Copy</button>
                                  <button onClick={() => handleRegenerateActionContent(actionItem)} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"><RefreshCw className="size-4" />Regenerate</button>
                                </div>
                              </div>
                              <div className="prose prose-sm max-w-none">
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
              <div className="space-y-3">
                {data.actions.map((action, index) => (
                  <div key={`${action.id}-${index}`} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:border-gray-300 transition">
                    <div className="flex items-start gap-4">
                      <div className="size-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-semibold shrink-0">
                        #{index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 text-sm mb-1">{action.title}</h3>
                        <p className="text-sm text-gray-500 leading-relaxed">{action.why}</p>
                        <p className="text-sm text-gray-600 mt-1">{action.what}</p>
                        <Button size="sm" onClick={() => handleGenerateDraft(action)} variant={subscription.isSubscribed ? "default" : "secondary"} className="mt-3">
                          {subscription.isSubscribed ? <Sparkles className="size-3.5 mr-1.5" /> : <Lock className="size-3.5 mr-1.5" />}
                          Generate draft
                          {!subscription.isSubscribed && <span className="ml-1.5 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">Pro</span>}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </FeatureGate>
        </section>

        {/* ================================================================ */}
        {/* SECTION 6: QUERY DETAILS (Collapsible)                           */}
        {/* ================================================================ */}
        {currentScanId && (
          <section>
            <QueryExplorer scanId={currentScanId} brandName={data.brand.name} />
          </section>
        )}

        {/* ================================================================ */}
        {/* BOTTOM BAR                                                       */}
        {/* ================================================================ */}
        <section>
          <div className="border-t border-gray-200 bg-white px-6 py-3 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-400 rounded-b-2xl gap-3">
            <span>Last scan: {formatScanDate(data.scanDate)} · Sources: ChatGPT, Claude</span>
            <div className="flex items-center gap-4">
              <button
                onClick={handleToggleRecurring}
                disabled={recurringLoading}
                className="flex items-center gap-2 text-xs"
              >
                <div className={cn("relative w-8 h-[18px] rounded-full transition-colors", isRecurring ? "bg-blue-600" : "bg-gray-300")}>
                  <div className={cn("absolute top-[2px] size-[14px] rounded-full bg-white transition-transform shadow-sm", isRecurring ? "translate-x-[15px]" : "translate-x-[2px]")} />
                </div>
                <span className={cn("transition-colors", isRecurring ? "text-gray-900" : "text-gray-400")}>Run weekly</span>
              </button>
              <button onClick={handleRunNewScan} className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1.5">
                <RefreshCw className="size-3.5" />
                Run new scan
                {!subscription.canScan && <Lock className="size-3 ml-1" />}
              </button>
            </div>
          </div>
        </section>

        </div>
      </div>

      {/* Modals */}
      {showUpgradeModal && (
        <UpgradePrompt feature={showUpgradeModal} onClose={() => setShowUpgradeModal(null)} />
      )}
      <ScanLimitModal
        isOpen={showScanLimitModal}
        onClose={() => setShowScanLimitModal(false)}
        scansUsed={subscription.scansUsed}
        scansLimit={subscription.scansLimit || 10}
        resetDate={subscription.nextResetDate}
      />
      <SlideOver open={selectedAction !== null} onClose={handleCloseSlideOver} title={selectedAction?.title || ""}>
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="size-8 text-gray-400 animate-spin mb-4" />
            <p className="text-gray-500">Generating your draft...</p>
          </div>
        ) : generatedContent ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <Button variant="ghost" size="sm" onClick={handleRegenerate} className="gap-1.5"><RotateCw className="size-3.5" />Regenerate</Button>
              <Button variant="secondary" size="sm" onClick={handleCopy} className="gap-1.5">
                {copied ? <><CheckCircle2 className="size-3.5" />Copied!</> : <><Copy className="size-3.5" />Copy to clipboard</>}
              </Button>
            </div>
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap text-sm text-gray-900 bg-gray-50 rounded-xl p-4 overflow-x-auto font-sans leading-relaxed">{generatedContent}</pre>
            </div>
          </div>
        ) : null}
      </SlideOver>
    </AppShell>
  )
}
