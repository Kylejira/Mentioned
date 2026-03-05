'use client'

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { AppShell } from "@/components/layout/app-shell"
import { useAuth } from "@/lib/auth"
import { useSubscription } from "@/lib/subscription"
import { UpgradePrompt } from "@/components/upgrade-prompt"
import { useToast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import {
  Sparkles,
  Loader2,
  Lock,
  Check,
  Eye,
  FileText,
  GitCompare,
  HelpCircle,
  Target,
  AlertCircle,
  ArrowLeft,
} from "lucide-react"
import { ContentPreviewModal } from "../components/content-preview-modal"

const SCAN_RESULT_KEY = "mentioned_scan_result"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ComparisonOpportunity {
  type: "comparison"
  competitor_name: string
  competitor_mentions: number
  brand_mentions: number
  priority: number
  intent: string
  trigger_queries: string[]
}

interface AnswerPageOpportunity {
  type: "answer_page"
  query_text: string
  competitors_in_response: string[]
  provider_count: number
  priority: number
  intent: string
}

interface FaqOpportunity {
  type: "faq"
  weak_category: string
  coverage_rate: number
  missed_queries: string[]
  priority: number
}

interface PositioningOpportunity {
  type: "positioning"
  priority: number
  gaps: string[]
  competitor_count: number
}

type ContentOpportunity =
  | ComparisonOpportunity
  | AnswerPageOpportunity
  | FaqOpportunity
  | PositioningOpportunity

interface ContentOpportunitiesData {
  comparison_pages: ComparisonOpportunity[]
  answer_pages: AnswerPageOpportunity[]
  faq_sets: FaqOpportunity[]
  positioning_briefs: PositioningOpportunity[]
  total_opportunities: number
  computed_at: string
}

interface GeneratedResult {
  id: string
  title: string
  body: string
  metadata: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Type config
// ---------------------------------------------------------------------------

interface TypeConfig {
  label: string
  icon: React.ReactNode
  description: string
  color: string
  bgColor: string
  borderColor: string
}

const TYPE_CONFIG: Record<string, TypeConfig> = {
  comparison: {
    label: "Comparison Page",
    icon: <GitCompare className="size-4" />,
    description: "Side-by-side comparison that helps AI position your product",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  answer_page: {
    label: "Answer Page",
    icon: <FileText className="size-4" />,
    description: "Comprehensive answer targeting a buyer query AI missed you on",
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
  },
  faq: {
    label: "FAQ Set",
    icon: <HelpCircle className="size-4" />,
    description: "Structured FAQ targeting weak intent categories",
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
  },
  positioning: {
    label: "Positioning Brief",
    icon: <Target className="size-4" />,
    description: "Messaging strategy based on competitor positioning gaps",
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
}

function getPriorityLabel(priority: number): { text: string; classes: string } {
  if (priority >= 70) return { text: "High Priority", classes: "bg-red-100 text-red-700" }
  if (priority >= 40) return { text: "Medium Priority", classes: "bg-amber-100 text-amber-700" }
  return { text: "Low Priority", classes: "bg-gray-100 text-gray-600" }
}

function formatIntent(intent: string): string {
  return intent.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

type FilterType = "all" | "comparison" | "answer_page" | "faq" | "positioning"

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ContentOpportunitiesPage() {
  const { user, loading: authLoading } = useAuth()
  const subscription = useSubscription()
  const { showToast } = useToast()

  const [data, setData] = useState<ContentOpportunitiesData | null>(null)
  const [scanId, setScanId] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [activeFilter, setActiveFilter] = useState<FilterType>("all")

  const [modalContent, setModalContent] = useState<GeneratedResult | null>(null)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [regenerateContext, setRegenerateContext] = useState<{
    scanId: string
    opportunity: ContentOpportunity
  } | null>(null)

  useEffect(() => {
    if (authLoading) return

    let cancelled = false

    const loadData = async () => {
      // Try localStorage first
      try {
        const userKey = user ? `${SCAN_RESULT_KEY}_${user.id}` : null
        const stored = (userKey && localStorage.getItem(userKey)) || localStorage.getItem(SCAN_RESULT_KEY)

        if (stored) {
          const parsed = JSON.parse(stored)
          if (parsed._content_opportunities) {
            if (cancelled) return
            setData(parsed._content_opportunities)
            if (parsed._scanId) setScanId(parsed._scanId)
            if (parsed.overallScore != null) setScore(parsed.overallScore)
            setIsLoading(false)
            return
          }
        }
      } catch {
        // fall through
      }

      // Fall back to API
      try {
        const response = await fetch("/api/scan-history/latest")
        if (cancelled) return

        if (response.ok) {
          const { scan } = await response.json()
          if (scan?.contentOpportunities) {
            setData(scan.contentOpportunities)
            if (scan.latestScanId) setScanId(scan.latestScanId)
            if (scan.score != null) setScore(scan.score)
          }
        }
      } catch {
        // non-fatal
      }

      if (!cancelled) setIsLoading(false)
    }

    loadData()
    return () => { cancelled = true }
  }, [authLoading, user])

  const handleViewContent = (result: GeneratedResult, opportunity: ContentOpportunity) => {
    setModalContent(result)
    if (scanId) setRegenerateContext({ scanId, opportunity })
  }

  const handleRegenerate = async () => {
    if (!regenerateContext) return
    setIsRegenerating(true)
    try {
      const res = await fetch("/api/generate-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scanId: regenerateContext.scanId,
          type: regenerateContext.opportunity.type,
          opportunityData: regenerateContext.opportunity,
          regenerate: true,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Regeneration failed")
      }
      const { content } = await res.json()
      setModalContent(content)
    } catch (err) {
      console.error("[ContentOpportunities] Regeneration failed:", err)
      showToast("Failed to regenerate content. Please try again.", "error")
    } finally {
      setIsRegenerating(false)
    }
  }

  const isPaid = subscription.isSubscribed

  const allOpportunities: ContentOpportunity[] = data
    ? [
        ...data.comparison_pages,
        ...data.answer_pages,
        ...data.faq_sets,
        ...data.positioning_briefs,
      ].sort((a, b) => b.priority - a.priority)
    : []

  const filteredOpportunities =
    activeFilter === "all"
      ? allOpportunities
      : allOpportunities.filter((o) => o.type === activeFilter)

  const groupCounts = data
    ? {
        comparison: data.comparison_pages.length,
        answer_page: data.answer_pages.length,
        faq: data.faq_sets.length,
        positioning: data.positioning_briefs.length,
      }
    : { comparison: 0, answer_page: 0, faq: 0, positioning: 0 }

  const isHighScore = score >= 75

  return (
    <AppShell>
      <div className="bg-gray-50 min-h-screen">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          {/* Back link */}
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition mb-6"
          >
            <ArrowLeft className="size-4" />
            Back to Dashboard
          </Link>

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="size-5 text-blue-500" />
              <h1 className="text-2xl font-bold text-gray-900">
                {isHighScore ? "Strengthen Your AI Position" : "Fix Your AI Visibility"}
              </h1>
            </div>
            <p className="text-gray-500">
              {isHighScore
                ? "You're already doing well. These content pieces can help you maintain and extend your lead."
                : "Content you can create to improve how AI models recommend your product. Each piece is generated from your actual scan data."}
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-6 text-gray-400 animate-spin" />
            </div>
          ) : !data || data.total_opportunities === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <p className="text-gray-500">No content opportunities found for your latest scan.</p>
              <Link href="/dashboard" className="text-blue-600 hover:text-blue-700 text-sm font-medium mt-2 inline-block">
                Return to Dashboard
              </Link>
            </div>
          ) : (
            <>
              {/* High score banner */}
              {isHighScore && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-start gap-3">
                  <span className="text-lg shrink-0">&#9989;</span>
                  <div>
                    <p className="text-sm font-medium text-green-800">Strong AI visibility detected</p>
                    <p className="text-xs text-green-700 mt-0.5">
                      AI already recommends you frequently. The content below can help reinforce your position and close remaining gaps.
                    </p>
                  </div>
                </div>
              )}

              {/* Filter tabs */}
              <div className="flex flex-wrap items-center gap-2 mb-6">
                <button
                  onClick={() => setActiveFilter("all")}
                  className={cn(
                    "text-sm font-medium px-3.5 py-1.5 rounded-full border transition",
                    activeFilter === "all"
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                  )}
                >
                  All ({data.total_opportunities})
                </button>
                {Object.entries(groupCounts)
                  .filter(([, count]) => count > 0)
                  .map(([type, count]) => {
                    const config = TYPE_CONFIG[type]
                    const isActive = activeFilter === type
                    return (
                      <button
                        key={type}
                        onClick={() => setActiveFilter(type as FilterType)}
                        className={cn(
                          "inline-flex items-center gap-1.5 text-sm font-medium px-3.5 py-1.5 rounded-full border transition",
                          isActive
                            ? cn(config.bgColor, config.borderColor, config.color)
                            : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                        )}
                      >
                        {config.icon}
                        {count} {config.label}{count !== 1 ? "s" : ""}
                      </button>
                    )
                  })}
              </div>

              {/* Opportunity cards */}
              <div className="space-y-3">
                {filteredOpportunities.map((opp, i) => (
                  <OpportunityCard
                    key={`${opp.type}-${i}`}
                    opportunity={opp}
                    scanId={scanId}
                    isPaid={isPaid}
                    onUpgrade={() => setShowUpgradeModal(true)}
                    onViewContent={(result) => handleViewContent(result, opp)}
                    onError={(msg) => showToast(msg, "error")}
                  />
                ))}
              </div>

              {filteredOpportunities.length === 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
                  <p className="text-gray-500 text-sm">No opportunities of this type.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Content Preview Modal */}
      <ContentPreviewModal
        open={modalContent !== null}
        content={modalContent}
        onClose={() => {
          setModalContent(null)
          setRegenerateContext(null)
        }}
        onRegenerate={handleRegenerate}
        isRegenerating={isRegenerating}
      />

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl max-w-md w-full mx-4 p-6">
            <UpgradePrompt
              feature="generate"
              onClose={() => setShowUpgradeModal(false)}
            />
          </div>
        </div>
      )}
    </AppShell>
  )
}

// ---------------------------------------------------------------------------
// OpportunityCard
// ---------------------------------------------------------------------------

type ButtonState = "default" | "loading" | "generated" | "locked" | "error"

function OpportunityCard({
  opportunity,
  scanId,
  isPaid,
  onUpgrade,
  onViewContent,
  onError,
}: {
  opportunity: ContentOpportunity
  scanId: string | null
  isPaid: boolean
  onUpgrade: () => void
  onViewContent: (result: GeneratedResult) => void
  onError?: (message: string) => void
}) {
  const [buttonState, setButtonState] = useState<ButtonState>(isPaid ? "default" : "locked")
  const [generatedResult, setGeneratedResult] = useState<GeneratedResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const config = TYPE_CONFIG[opportunity.type]
  const priorityInfo = getPriorityLabel(opportunity.priority)

  const handleGenerate = useCallback(async () => {
    if (!isPaid) {
      onUpgrade()
      return
    }
    if (!scanId) return

    setButtonState("loading")
    setErrorMessage(null)

    try {
      const res = await fetch("/api/generate-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scanId,
          type: opportunity.type,
          opportunityData: opportunity,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (err.code === "PLAN_REQUIRED") {
          setButtonState("locked")
          onUpgrade()
          return
        }
        throw new Error(err.error || "Generation failed")
      }

      const { content } = await res.json()
      setGeneratedResult(content)
      setButtonState("generated")
      onViewContent(content)
    } catch (err) {
      console.error("[ContentOpportunities] Generation failed:", err)
      const msg = err instanceof Error ? err.message : "Content generation failed"
      setErrorMessage(msg)
      setButtonState("error")
      onError?.("Content generation failed. Click Retry to try again.")
    }
  }, [isPaid, scanId, opportunity, onUpgrade, onViewContent, onError])

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:border-gray-300 transition">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border",
                config.bgColor,
                config.borderColor,
                config.color
              )}
            >
              {config.icon}
              {config.label}
            </span>
            <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", priorityInfo.classes)}>
              {priorityInfo.text}
            </span>
          </div>

          <div className="mt-3">
            <CardDetails opportunity={opportunity} />
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-2">
          <GenerateButton
            state={buttonState}
            onGenerate={handleGenerate}
            onUpgrade={onUpgrade}
          />
          {buttonState === "generated" && generatedResult && (
            <button
              onClick={() => onViewContent(generatedResult)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition"
            >
              <Eye className="size-3.5" />
              View Generated Content
            </button>
          )}
        </div>
      </div>

      {buttonState === "error" && errorMessage && (
        <div className="mt-3 flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
          <span className="text-sm text-red-700 flex-1">{errorMessage}</span>
          <button
            onClick={() => {
              setButtonState("default")
              setErrorMessage(null)
              handleGenerate()
            }}
            className="text-xs font-semibold text-red-700 hover:text-red-800 underline shrink-0"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CardDetails
// ---------------------------------------------------------------------------

function CardDetails({ opportunity }: { opportunity: ContentOpportunity }) {
  switch (opportunity.type) {
    case "comparison": {
      const opp = opportunity as ComparisonOpportunity
      return (
        <>
          <h4 className="font-semibold text-gray-900 text-sm">
            {opp.competitor_name} vs Your Product
          </h4>
          <p className="text-sm text-gray-500 mt-1">
            {opp.competitor_name} is mentioned <strong>{opp.competitor_mentions}x</strong> by AI
            {opp.brand_mentions > 0
              ? ` (you: ${opp.brand_mentions}x)`
              : " — you're not mentioned at all"}
          </p>
          {opp.trigger_queries.length > 0 && (
            <TriggerQueries queries={opp.trigger_queries} />
          )}
        </>
      )
    }

    case "answer_page": {
      const opp = opportunity as AnswerPageOpportunity
      return (
        <>
          <h4 className="font-semibold text-gray-900 text-sm">
            &ldquo;{opp.query_text}&rdquo;
          </h4>
          <p className="text-sm text-gray-500 mt-1">
            AI recommends{" "}
            <strong>
              {opp.competitors_in_response.slice(0, 3).join(", ")}
              {opp.competitors_in_response.length > 3
                ? ` +${opp.competitors_in_response.length - 3} more`
                : ""}
            </strong>{" "}
            for this query — but not you.
            {opp.provider_count > 1 && (
              <span className="text-gray-400">
                {" "}Across {opp.provider_count} AI providers.
              </span>
            )}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {formatIntent(opp.intent)}
            </span>
          </div>
        </>
      )
    }

    case "faq": {
      const opp = opportunity as FaqOpportunity
      return (
        <>
          <h4 className="font-semibold text-gray-900 text-sm">
            FAQ Set: {formatIntent(opp.weak_category)} Queries
          </h4>
          <p className="text-sm text-gray-500 mt-1">
            Your brand coverage is only <strong>{Math.round(opp.coverage_rate * 100)}%</strong> for{" "}
            {formatIntent(opp.weak_category).toLowerCase()} queries.
          </p>
          {opp.missed_queries.length > 0 && (
            <TriggerQueries queries={opp.missed_queries} label="Missed queries" />
          )}
        </>
      )
    }

    case "positioning": {
      const opp = opportunity as PositioningOpportunity
      return (
        <>
          <h4 className="font-semibold text-gray-900 text-sm">
            Positioning Strategy Brief
          </h4>
          <p className="text-sm text-gray-500 mt-1">
            {opp.competitor_count} competitor{opp.competitor_count !== 1 ? "s" : ""} have structured
            positioning that AI models favor.
          </p>
          {opp.gaps.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {opp.gaps.map((gap, i) => (
                <span
                  key={i}
                  className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full"
                >
                  {gap}
                </span>
              ))}
            </div>
          )}
        </>
      )
    }
  }
}

// ---------------------------------------------------------------------------
// TriggerQueries
// ---------------------------------------------------------------------------

function TriggerQueries({ queries, label = "Trigger queries" }: { queries: string[]; label?: string }) {
  const [expanded, setExpanded] = useState(false)
  const preview = queries.slice(0, 2)
  const rest = queries.slice(2)

  return (
    <div className="mt-2">
      <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">{label}</div>
      <div className="space-y-1">
        {preview.map((q, i) => (
          <p key={i} className="text-xs text-gray-600 leading-relaxed">
            &ldquo;{q}&rdquo;
          </p>
        ))}
        {rest.length > 0 && (
          <>
            {expanded && rest.map((q, i) => (
              <p key={i + 2} className="text-xs text-gray-600 leading-relaxed">
                &ldquo;{q}&rdquo;
              </p>
            ))}
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[11px] text-gray-400 hover:text-gray-600 transition"
            >
              {expanded ? "Show less" : `+${rest.length} more`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// GenerateButton
// ---------------------------------------------------------------------------

function GenerateButton({
  state,
  onGenerate,
  onUpgrade,
}: {
  state: ButtonState
  onGenerate: () => void
  onUpgrade: () => void
}) {
  switch (state) {
    case "locked":
      return (
        <button
          onClick={onUpgrade}
          className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 transition"
        >
          <Lock className="size-3.5" />
          Generate
          <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold ml-1">
            Pro
          </span>
        </button>
      )

    case "loading":
      return (
        <button
          disabled
          className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl bg-blue-600 text-white opacity-80 cursor-not-allowed"
        >
          <Loader2 className="size-3.5 animate-spin" />
          Generating...
        </button>
      )

    case "generated":
      return (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl bg-green-50 text-green-700 border border-green-200">
          <Check className="size-3.5" />
          Generated
        </span>
      )

    case "error":
      return (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl bg-red-50 text-red-600 border border-red-200">
          <AlertCircle className="size-3.5" />
          Failed
        </span>
      )

    case "default":
    default:
      return (
        <button
          onClick={onGenerate}
          className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition"
        >
          <Sparkles className="size-3.5" />
          Generate
        </button>
      )
  }
}
