'use client'

import { useState } from "react"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

// ---------------------------------------------------------------------------
// Types (mirrors backend CompetitorReasonAnalysis)
// ---------------------------------------------------------------------------

interface ExtractedReason {
  reason: string
  category: string
  frequency: number
  sample_quote: string
}

interface CompetitorReasonEntry {
  name: string
  total_mentions: number
  reasons: ExtractedReason[]
  top_categories: string[]
  positioning_summary: string
}

interface CategoryLeader {
  category: string
  leader: string
  frequency: number
}

interface OverflowCompetitor {
  name: string
  total_mentions: number
}

interface CompetitorReasonData {
  competitors: CompetitorReasonEntry[]
  category_leaders: CategoryLeader[]
  insights: string[]
  overflow_competitors?: OverflowCompetitor[]
  computed_at: string
}

// ---------------------------------------------------------------------------
// Category styling
// ---------------------------------------------------------------------------

interface CategoryStyle {
  pill: string
  dot: string
}

const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  pricing:       { pill: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  ease_of_use:   { pill: "bg-blue-100 text-blue-700",      dot: "bg-blue-500" },
  performance:   { pill: "bg-purple-100 text-purple-700",   dot: "bg-purple-500" },
  features:      { pill: "bg-indigo-100 text-indigo-700",   dot: "bg-indigo-500" },
  integrations:  { pill: "bg-cyan-100 text-cyan-700",       dot: "bg-cyan-500" },
  enterprise:    { pill: "bg-slate-100 text-slate-700",     dot: "bg-slate-500" },
  community:     { pill: "bg-amber-100 text-amber-700",     dot: "bg-amber-500" },
  documentation: { pill: "bg-teal-100 text-teal-700",       dot: "bg-teal-500" },
  open_source:   { pill: "bg-lime-100 text-lime-700",       dot: "bg-lime-500" },
  customization: { pill: "bg-violet-100 text-violet-700",   dot: "bg-violet-500" },
  security:      { pill: "bg-red-100 text-red-700",         dot: "bg-red-500" },
  support:       { pill: "bg-orange-100 text-orange-700",   dot: "bg-orange-500" },
  scalability:   { pill: "bg-fuchsia-100 text-fuchsia-700", dot: "bg-fuchsia-500" },
  design:        { pill: "bg-pink-100 text-pink-700",       dot: "bg-pink-500" },
  reliability:   { pill: "bg-stone-100 text-stone-700",     dot: "bg-stone-500" },
}

const DEFAULT_STYLE: CategoryStyle = { pill: "bg-gray-100 text-gray-600", dot: "bg-gray-400" }

function getCategoryStyle(category: string): CategoryStyle {
  return CATEGORY_STYLES[category] || DEFAULT_STYLE
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function capitalize(name: string): string {
  if (!name) return ""
  return name.charAt(0).toUpperCase() + name.slice(1)
}

function formatCategory(slug: string): string {
  return slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function classifyInsight(text: string): { icon: string; accent: string } {
  const t = text.toLowerCase()
  if (t.includes("dominat") || t.includes("strong"))
    return { icon: "🏆", accent: "bg-amber-50 border-amber-200" }
  if (t.includes("gap") || t.includes("unclaimed") || t.includes("no competitor"))
    return { icon: "🎯", accent: "bg-green-50 border-green-200" }
  if (t.includes("common theme") || t.includes("multiple") || t.includes("competitors"))
    return { icon: "📊", accent: "bg-blue-50 border-blue-200" }
  if (t.includes("brand-driven") || t.includes("no reasons"))
    return { icon: "🔍", accent: "bg-gray-50 border-gray-200" }
  return { icon: "💡", accent: "bg-amber-50 border-amber-200" }
}

// ---------------------------------------------------------------------------
// Main section
// ---------------------------------------------------------------------------

interface CompetitorReasonsSectionProps {
  data: CompetitorReasonData | null
}

export function CompetitorReasonsSection({ data }: CompetitorReasonsSectionProps) {
  if (!data || !data.competitors || data.competitors.length === 0) return null

  return (
    <section>
      <h2 className="text-lg font-bold text-gray-900">Why AI Recommends Your Competitors</h2>
      <p className="text-sm text-gray-500 mt-1 mb-5">
        Extracted from actual AI responses — what positioning signals AI models associate with each competitor.
      </p>

      {/* Competitor cards */}
      <div className="space-y-4">
        {data.competitors.map((comp) => (
          <CompetitorReasonCard key={comp.name} competitor={comp} />
        ))}
      </div>

      {/* Overflow competitors (beyond top 8) */}
      {data.overflow_competitors && data.overflow_competitors.length > 0 && (
        <OtherCompetitorsRow competitors={data.overflow_competitors} />
      )}

      {/* Category leaders */}
      <CategoryLeaderBar leaders={data.category_leaders} />

      {/* Insights */}
      <ReasonInsights insights={data.insights} />
    </section>
  )
}

// ---------------------------------------------------------------------------
// CategoryLeaderBar — which competitor leads each positioning category
// ---------------------------------------------------------------------------

function CategoryLeaderBar({ leaders }: { leaders: CategoryLeader[] }) {
  if (!leaders || leaders.length === 0) return null

  return (
    <div className="mt-5 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-3">
        Category Leaders
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {leaders.slice(0, 9).map((leader) => {
          const style = getCategoryStyle(leader.category)
          return (
            <div
              key={leader.category}
              className="flex items-center gap-2.5 rounded-xl border border-gray-100 px-3 py-2.5 bg-gray-50/50"
            >
              <span className={cn("shrink-0 w-2.5 h-2.5 rounded-full", style.dot)} />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-gray-900 truncate">
                  {formatCategory(leader.category)}
                </div>
                <div className="text-[10px] text-gray-500 truncate">
                  Led by <span className="font-medium text-gray-700">{capitalize(leader.leader)}</span>
                  <span className="text-gray-400 ml-1">({leader.frequency}x)</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ReasonInsights — styled insight cards
// ---------------------------------------------------------------------------

function ReasonInsights({ insights }: { insights: string[] }) {
  if (!insights || insights.length === 0) return null

  return (
    <div className="mt-5">
      <div className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-3">
        Key Insights
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {insights.map((insight, i) => {
          const { icon, accent } = classifyInsight(insight)
          return (
            <div
              key={i}
              className={cn("rounded-xl border p-4 flex items-start gap-3", accent)}
            >
              <span className="text-lg shrink-0 mt-0.5">{icon}</span>
              <p className="text-sm text-gray-700 leading-relaxed">{insight}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// OtherCompetitorsRow — collapsed row for competitors beyond the top 8
// ---------------------------------------------------------------------------

function OtherCompetitorsRow({ competitors }: { competitors: OverflowCompetitor[] }) {
  const [expanded, setExpanded] = useState(false)

  const totalMentions = competitors.reduce((s, c) => s + c.total_mentions, 0)

  return (
    <div className="mt-4 bg-white rounded-2xl border border-gray-200 shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition rounded-2xl"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex -space-x-1.5">
            {competitors.slice(0, 3).map((c) => (
              <div
                key={c.name}
                className="w-6 h-6 rounded-md bg-gray-100 border-2 border-white flex items-center justify-center text-[9px] font-bold text-gray-500"
              >
                {c.name.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>
          <span className="text-sm font-medium text-gray-700">
            {competitors.length} other competitor{competitors.length !== 1 ? "s" : ""}
          </span>
          <span className="text-xs text-gray-400">
            {totalMentions} total mention{totalMentions !== 1 ? "s" : ""}
          </span>
        </div>
        <ChevronDown className={cn("size-4 text-gray-400 transition-transform", expanded && "rotate-180")} />
      </button>
      {expanded && (
        <div className="px-5 pb-4 pt-0 border-t border-gray-100">
          <div className="space-y-2 mt-3">
            {competitors.map((c) => (
              <div key={c.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-[9px] font-bold text-gray-500">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-gray-700">{capitalize(c.name)}</span>
                </div>
                <span className="text-xs text-gray-400 tabular-nums">
                  {c.total_mentions} mention{c.total_mentions !== 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            These competitors were mentioned less frequently. Only the top 8 competitors are analyzed in detail.
          </p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CompetitorReasonCard
// ---------------------------------------------------------------------------

function CompetitorReasonCard({ competitor }: { competitor: CompetitorReasonEntry }) {
  const [expanded, setExpanded] = useState(false)

  const hasReasons = competitor.reasons.length > 0
  const topQuote = hasReasons ? competitor.reasons[0].sample_quote : null
  const additionalQuotes = hasReasons
    ? competitor.reasons.slice(1).filter((r) => r.sample_quote).map((r) => r.sample_quote)
    : []

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600 font-bold text-sm">
            {competitor.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <span className="font-semibold text-gray-900">{capitalize(competitor.name)}</span>
            <span className="text-xs text-gray-400 ml-2">
              {competitor.total_mentions} mention{competitor.total_mentions !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        {competitor.top_categories.length > 0 && (
          <div className="flex gap-1.5 flex-wrap justify-end">
            {competitor.top_categories.slice(0, 2).map((cat) => (
              <span
                key={cat}
                className={cn(
                  "text-[10px] font-medium px-2 py-0.5 rounded-full",
                  getCategoryStyle(cat).pill
                )}
              >
                {formatCategory(cat)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Reasons list */}
      {hasReasons ? (
        <div className="mt-4 space-y-2">
          {competitor.reasons.map((reason, i) => {
            const style = getCategoryStyle(reason.category)
            return (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn("shrink-0 w-1.5 h-1.5 rounded-full", style.dot)} />
                  <span className="text-sm text-gray-800 truncate">{reason.reason}</span>
                  <span
                    className={cn(
                      "shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full",
                      style.pill
                    )}
                  >
                    {formatCategory(reason.category)}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-gray-400 tabular-nums ml-3">{reason.frequency}x</span>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="mt-4 text-sm text-gray-400 italic">
          {capitalize(competitor.name)} is mentioned {competitor.total_mentions} time{competitor.total_mentions !== 1 ? "s" : ""} but AI doesn&apos;t cite specific reasons. Their visibility may be brand-driven.
        </p>
      )}

      {/* Top quote */}
      {topQuote && (
        <div className="mt-4 border-l-2 border-blue-300 pl-3 py-2 bg-blue-50/50 rounded-r-lg">
          <p className="text-sm text-gray-600 italic leading-relaxed">&ldquo;{topQuote}&rdquo;</p>
        </div>
      )}

      {/* Expand for more quotes */}
      {additionalQuotes.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition"
          >
            <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
            {expanded ? "Hide quotes" : `Show ${additionalQuotes.length} more quote${additionalQuotes.length !== 1 ? "s" : ""}`}
          </button>
          {expanded && (
            <div className="mt-2 space-y-2">
              {additionalQuotes.map((quote, i) => (
                <div key={i} className="border-l-2 border-gray-200 pl-3 py-2 bg-gray-50/50 rounded-r-lg">
                  <p className="text-sm text-gray-500 italic leading-relaxed">&ldquo;{quote}&rdquo;</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Positioning summary */}
      {competitor.positioning_summary && hasReasons && (
        <p className="mt-4 text-xs text-gray-500 leading-relaxed">
          {competitor.positioning_summary}
        </p>
      )}
    </div>
  )
}
