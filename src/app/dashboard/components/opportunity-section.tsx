'use client'

import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types (mirrors OpportunityMetrics from opportunity-analyzer.ts)
// ---------------------------------------------------------------------------

interface CompetitorShare {
  name: string
  mentions: number
  share: number
}

interface OpportunityData {
  total_queries: number
  total_query_provider_pairs: number
  brand_mention_count: number
  competitor_mention_count: number
  queries_with_any_mention: number
  queries_with_no_mention: number
  brand_capture_rate: number
  competitor_capture_rate: number
  shared_capture_rate: number
  uncaptured_rate: number
  opportunity_gap: "Low" | "Moderate" | "High" | "Critical"
  top_competitors: CompetitorShare[]
  brand_share: number
  insights: string[]
  computed_at: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GAP_BADGE: Record<string, { classes: string }> = {
  Critical: { classes: "bg-red-100 text-red-700 border border-red-200" },
  High:     { classes: "bg-orange-100 text-orange-700 border border-orange-200" },
  Moderate: { classes: "bg-amber-100 text-amber-700 border border-amber-200" },
  Low:      { classes: "bg-green-100 text-green-700 border border-green-200" },
}

const GAP_MESSAGE: Record<string, { headline: string; subtext: string }> = {
  Critical: {
    headline: "Competitors dominate AI recommendations",
    subtext: "Your brand doesn't appear when buyers ask AI for help. Competitors capture nearly all recommendation demand.",
  },
  High: {
    headline: "Significant competitor advantage",
    subtext: "You appear in some AI recommendations, but competitors capture the majority. There's major room to improve.",
  },
  Moderate: {
    headline: "Room to grow",
    subtext: "You have a presence in AI recommendations, but competitors still capture more demand. Optimization can close the gap.",
  },
  Low: {
    headline: "Strong AI presence",
    subtext: "You capture a healthy share of AI recommendations. Focus on maintaining your position and expanding into uncaptured queries.",
  },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pct(value: number): string {
  return `${Math.round(value * 100)}%`
}

function capitalize(name: string): string {
  if (!name) return ""
  return name.charAt(0).toUpperCase() + name.slice(1)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface OpportunitySectionProps {
  data: OpportunityData | null
  brandName?: string
}

export function OpportunitySection({ data, brandName = "Your brand" }: OpportunitySectionProps) {
  if (!data) return null

  const hasAnyData = data.total_query_provider_pairs > 0 &&
    (data.brand_mention_count > 0 || data.competitor_mention_count > 0 || data.queries_with_no_mention > 0)

  if (!hasAnyData) {
    return (
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">AI Traffic Opportunity</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              How much AI recommendation demand are you capturing?
            </p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <p className="text-gray-500 text-sm">
            Not enough scan data yet to analyze AI traffic opportunity. Run a full scan to see how much recommendation demand you&#39;re capturing versus competitors.
          </p>
        </div>
      </section>
    )
  }

  const gap = data.opportunity_gap
  const badge = GAP_BADGE[gap] || GAP_BADGE.Critical
  const message = GAP_MESSAGE[gap] || GAP_MESSAGE.Critical

  const brandBarPct = Math.round((data.brand_capture_rate + data.shared_capture_rate) * 100)
  const compBarPct = Math.round(data.competitor_capture_rate * 100)
  const uncapturedBarPct = Math.round(data.uncaptured_rate * 100)

  const topCompMentions = data.top_competitors.length > 0
    ? data.top_competitors[0].mentions
    : 0

  const hasCompetitors = data.top_competitors.length > 0
  const isSmallSample = data.total_queries < 10
  const allUncaptured =
    data.queries_with_any_mention === 0 && data.total_query_provider_pairs > 0

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">AI Traffic Opportunity</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            How much AI recommendation demand are you capturing?
          </p>
        </div>
        <span className={cn("text-xs font-bold px-3 py-1 rounded-full", badge.classes)}>
          {gap} Gap
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">

        {/* --- Gap headline --- */}
        <div>
          <h3 className="font-semibold text-gray-900">{message.headline}</h3>
          <p className="text-sm text-gray-500 mt-1">{message.subtext}</p>
        </div>

        {/* --- Small sample disclaimer --- */}
        {isSmallSample && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-700">
            Based on a small sample ({data.total_queries} queries). Run a full scan for more accurate results.
          </div>
        )}

        {/* --- Metrics grid --- */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            label="AI Demand Tested"
            value={`${data.total_query_provider_pairs}`}
            sublabel={`${data.total_queries} queries × providers`}
          />
          <MetricCard
            label="Your Brand Mentions"
            value={`${data.brand_mention_count}`}
            sublabel={`You captured ${pct(data.brand_capture_rate)}`}
            valueColor={data.brand_mention_count > 0 ? "text-green-600" : "text-red-600"}
          />
          <MetricCard
            label="Competitor Mentions"
            value={`${data.competitor_mention_count}`}
            sublabel={hasCompetitors
              ? `Competitors captured ${pct(data.competitor_capture_rate)}`
              : "No competitors detected"
            }
            valueColor={data.competitor_mention_count > 0 ? "text-red-600" : "text-gray-400"}
          />
          <MetricCard
            label="Uncaptured Demand"
            value={`${data.queries_with_no_mention}`}
            sublabel={`${pct(data.uncaptured_rate)} with no recommendation`}
          />
        </div>

        {/* --- Demand share bar --- */}
        <div>
          <div className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-2">
            Demand Share
          </div>

          {allUncaptured ? (
            <div className="w-full h-5 rounded-full bg-gray-200" />
          ) : (
            <div className="w-full h-5 rounded-full bg-gray-100 flex overflow-hidden">
              {brandBarPct > 0 && (
                <div
                  className="h-full bg-green-500 transition-all duration-500"
                  style={{ width: `${brandBarPct}%` }}
                />
              )}
              {compBarPct > 0 && (
                <div
                  className="h-full bg-red-500 transition-all duration-500"
                  style={{ width: `${compBarPct}%` }}
                />
              )}
              {uncapturedBarPct > 0 && (
                <div
                  className="h-full bg-gray-300 transition-all duration-500"
                  style={{ width: `${uncapturedBarPct}%` }}
                />
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-sm">
            <span className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-green-500" />
              Your brand: {pct(data.brand_capture_rate + data.shared_capture_rate)}
            </span>
            {hasCompetitors && (
              <span className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-red-500" />
                Competitors: {pct(data.competitor_capture_rate)}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-gray-300" />
              No recommendation: {pct(data.uncaptured_rate)}
            </span>
          </div>
        </div>

        {/* --- Competitor capture list --- */}
        {hasCompetitors && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-3">
              Who Captures AI Demand
            </div>
            <div className="space-y-3">
              {data.top_competitors.map((comp, i) => (
                <CompetitorRow
                  key={comp.name}
                  rank={i + 1}
                  name={capitalize(comp.name)}
                  mentions={comp.mentions}
                  share={comp.share}
                  maxMentions={topCompMentions}
                  accent="red"
                />
              ))}

              {/* Divider */}
              <div className="border-t border-gray-200 my-1" />

              {/* User's brand */}
              <CompetitorRow
                rank={null}
                name={brandName}
                mentions={data.brand_mention_count}
                share={data.brand_share}
                maxMentions={topCompMentions}
                accent="green"
              />
            </div>
          </div>
        )}

        {/* --- Insights --- */}
        <OpportunityInsights insights={data.insights} gap={gap} />
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetricCard({
  label,
  value,
  sublabel,
  valueColor = "text-gray-900",
}: {
  label: string
  value: string
  sublabel: string
  valueColor?: string
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
        {label}
      </div>
      <div className={cn("text-2xl font-bold mt-1", valueColor)}>
        {value}
      </div>
      <div className="text-[10px] text-gray-400 mt-0.5">
        {sublabel}
      </div>
    </div>
  )
}

const INSIGHT_ICONS: Record<string, string> = {
  competitors: "📊",
  strong: "💪",
  topcomp: "⚠️",
  uncaptured: "🔍",
  invisible: "🚨",
  shared: "🤝",
  maintain: "✅",
}

function classifyInsight(text: string): { icon: string; accent: string } {
  const t = text.toLowerCase()

  if (t.includes("was not mentioned") || t.includes("capture 100%"))
    return { icon: INSIGHT_ICONS.invisible, accent: "border-red-200 bg-red-50" }

  if (t.includes("competitors capture") && !t.includes("strong"))
    return { icon: INSIGHT_ICONS.competitors, accent: "border-orange-200 bg-orange-50" }

  if (t.includes("is mentioned") && t.includes("more often"))
    return { icon: INSIGHT_ICONS.topcomp, accent: "border-amber-200 bg-amber-50" }

  if (t.includes("no product recommendation") || t.includes("no recommendation"))
    return { icon: INSIGHT_ICONS.uncaptured, accent: "border-blue-200 bg-blue-50" }

  if (t.includes("alongside competitors"))
    return { icon: INSIGHT_ICONS.shared, accent: "border-gray-200 bg-gray-50" }

  if (t.includes("strong position") || t.includes("you capture"))
    return { icon: INSIGHT_ICONS.strong, accent: "border-green-200 bg-green-50" }

  if (t.includes("maintain") || t.includes("monitor"))
    return { icon: INSIGHT_ICONS.maintain, accent: "border-green-200 bg-green-50" }

  return { icon: "💡", accent: "border-gray-200 bg-gray-50" }
}

function OpportunityInsights({
  insights,
  gap,
}: {
  insights: string[]
  gap: string
}) {
  if (!insights || insights.length === 0) return null

  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-3">
        Key Insights
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {insights.map((insight, i) => {
          const { icon, accent } = classifyInsight(insight)
          return (
            <div
              key={i}
              className={cn(
                "rounded-xl border p-4 flex items-start gap-3",
                accent
              )}
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

function CompetitorRow({
  rank,
  name,
  mentions,
  share,
  maxMentions,
  accent,
}: {
  rank: number | null
  name: string
  mentions: number
  share: number
  maxMentions: number
  accent: "red" | "green"
}) {
  const barWidth = maxMentions > 0
    ? Math.max(2, Math.round((mentions / maxMentions) * 100))
    : 0
  const barColor = accent === "green" ? "bg-green-500" : "bg-red-500"
  const textColor = accent === "green" ? "text-green-600" : "text-gray-900"

  return (
    <div className="flex items-center gap-3">
      <div className="w-5 text-xs text-gray-400 text-right shrink-0">
        {rank != null ? `${rank}.` : ""}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className={cn("text-sm font-medium truncate", textColor)}>
            {name}
          </span>
          <span className="text-xs text-gray-500 shrink-0 ml-2">
            {mentions} mentions &middot; {pct(share)}
          </span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full">
          <div
            className={cn("h-2 rounded-full transition-all duration-500", barColor)}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>
    </div>
  )
}
