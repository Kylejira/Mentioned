'use client'

import { useState, useCallback } from "react"
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
} from "lucide-react"
import { ContentPreviewModal } from "./content-preview-modal"

// ---------------------------------------------------------------------------
// Types (mirrors backend ContentOpportunities)
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
// Props
// ---------------------------------------------------------------------------

interface ContentOpportunitiesSectionProps {
  data: ContentOpportunitiesData | null
  scanId: string | null
  isPaid: boolean
  score: number
  onUpgrade: () => void
  onError?: (message: string) => void
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
// Main section
// ---------------------------------------------------------------------------

export function ContentOpportunitiesSection({
  data,
  scanId,
  isPaid,
  score,
  onUpgrade,
  onError,
}: ContentOpportunitiesSectionProps) {
  const [modalContent, setModalContent] = useState<GeneratedResult | null>(null)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [regenerateContext, setRegenerateContext] = useState<{
    scanId: string
    opportunity: ContentOpportunity
  } | null>(null)

  if (!data || data.total_opportunities === 0) return null

  const isHighScore = score >= 75

  const allOpportunities: ContentOpportunity[] = [
    ...data.comparison_pages,
    ...data.answer_pages,
    ...data.faq_sets,
    ...data.positioning_briefs,
  ].sort((a, b) => b.priority - a.priority)

  const groupCounts = {
    comparison: data.comparison_pages.length,
    answer_page: data.answer_pages.length,
    faq: data.faq_sets.length,
    positioning: data.positioning_briefs.length,
  }

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
      onError?.("Failed to regenerate content. Please try again.")
    } finally {
      setIsRegenerating(false)
    }
  }

  const sectionTitle = isHighScore ? "Strengthen Your AI Position" : "Fix Your AI Visibility"
  const sectionSubtitle = isHighScore
    ? "You're already doing well. These content pieces can help you maintain and extend your lead."
    : "Content you can create to improve how AI models recommend your product. Each piece is generated from your actual scan data."

  return (
    <section>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Sparkles className="size-5 text-blue-500" />
          {sectionTitle}
        </h2>
        <span className="text-xs text-gray-400">
          {data.total_opportunities} opportunit{data.total_opportunities === 1 ? "y" : "ies"} found
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-5">
        {sectionSubtitle}
      </p>

      {isHighScore && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-5 flex items-start gap-3">
          <span className="text-lg shrink-0">&#9989;</span>
          <div>
            <p className="text-sm font-medium text-green-800">Strong AI visibility detected</p>
            <p className="text-xs text-green-700 mt-0.5">
              AI already recommends you frequently. The content below can help reinforce your position and close remaining gaps.
            </p>
          </div>
        </div>
      )}

      {/* Type summary chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        {Object.entries(groupCounts)
          .filter(([, count]) => count > 0)
          .map(([type, count]) => {
            const config = TYPE_CONFIG[type]
            return (
              <span
                key={type}
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border",
                  config.bgColor,
                  config.borderColor,
                  config.color
                )}
              >
                {config.icon}
                {count} {config.label}{count !== 1 ? "s" : ""}
              </span>
            )
          })}
      </div>

      {/* Opportunity cards */}
      <div className="space-y-3">
        {allOpportunities.map((opp, i) => (
          <OpportunityCard
            key={`${opp.type}-${i}`}
            opportunity={opp}
            scanId={scanId}
            isPaid={isPaid}
            onUpgrade={onUpgrade}
            onViewContent={(result) => handleViewContent(result, opp)}
            onError={onError}
          />
        ))}
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
    </section>
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
        {/* Left: type badge + content */}
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

          {/* Card-specific content */}
          <div className="mt-3">
            <CardDetails opportunity={opportunity} />
          </div>
        </div>

        {/* Right: generate / view button */}
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

      {/* Error state with retry */}
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
// CardDetails — renders type-specific info
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
// TriggerQueries — collapsible list of queries that triggered this opportunity
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
// GenerateButton — 4 states: default, loading, generated, locked
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
