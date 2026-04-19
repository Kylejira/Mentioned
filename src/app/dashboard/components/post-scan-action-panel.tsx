'use client'

import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  Zap,
  Lock,
  Eye,
  ChevronDown,
  ChevronUp,
  Target,
  Lightbulb,
  ArrowRight,
  Search,
  FileText,
  BarChart3,
  Sparkles,
} from "lucide-react"
import type { QueryResult, Competitor, RawResponse } from "@/lib/mock-data"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PostScanActionPanelProps {
  brandName: string
  score: number
  mentionRate: number
  queries: QueryResult[]
  competitors: Competitor[]
  rawResponses: RawResponse[]
  isFreePlan: boolean
  onUpgrade: () => void
}

interface MissedQuery {
  query: string
  competitorsMentioned: string[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMissedQueries(
  queries: QueryResult[],
  rawResponses: RawResponse[],
  competitors: Competitor[]
): MissedQuery[] {
  const competitorNames = competitors
    .filter((c) => c.mentioned && c.name)
    .map((c) => c.name.toLowerCase())

  const missedQueries: MissedQuery[] = []

  for (const q of queries) {
    const mentioned = q.chatgpt || q.claude
    if (mentioned) continue

    const raw = rawResponses.find(
      (r) => r.query === q.query || r.query === (q as any).text
    )
    const responseText = [raw?.chatgpt_response, raw?.claude_response]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()

    const foundCompetitors = competitors
      .filter(
        (c) =>
          c.mentioned && c.name && responseText.includes(c.name.toLowerCase())
      )
      .map((c) => c.name)

    missedQueries.push({
      query: q.query,
      competitorsMentioned: foundCompetitors,
    })
  }

  return missedQueries.sort(
    (a, b) => b.competitorsMentioned.length - a.competitorsMentioned.length
  )
}

function generateSuggestions(
  missedQueries: MissedQuery[],
  competitors: Competitor[],
  score: number,
  brandName: string
): string[] {
  const suggestions: string[] = []

  const topCompetitors = competitors
    .filter((c) => c.mentioned && c.mentionCount && c.mentionCount > 0)
    .sort((a, b) => (b.mentionCount || 0) - (a.mentionCount || 0))
    .slice(0, 3)

  if (topCompetitors.length > 0) {
    suggestions.push(
      `Create comparison content (e.g. "${brandName} vs ${topCompetitors[0].name}") to appear in head-to-head AI queries.`
    )
  }

  if (missedQueries.length > 0) {
    suggestions.push(
      `Publish detailed pages targeting the ${missedQueries.length} queries where you're not being mentioned — these are your biggest gaps.`
    )
  }

  if (score < 50) {
    suggestions.push(
      "Improve your product descriptions with natural, question-and-answer language that matches how people ask AI for recommendations."
    )
  }

  suggestions.push(
    "Get mentioned on third-party review sites and comparison platforms — AI models use these as training sources."
  )

  if (topCompetitors.length >= 2) {
    suggestions.push(
      `Create FAQ content addressing "${brandName} vs alternatives" to establish your positioning in AI context.`
    )
  }

  if (score < 30) {
    suggestions.push(
      "Submit your site to OpenAI and Bing Webmaster Tools so AI crawlers can index your content."
    )
  }

  return suggestions
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function VisibilityBreakdown({
  brandName,
  queries,
  competitors,
}: {
  brandName: string
  queries: QueryResult[]
  competitors: Competitor[]
}) {
  const totalQueries = queries.length
  const mentionedQueries = queries.filter((q) => q.chatgpt || q.claude).length
  const topCompetitors = competitors
    .filter((c) => c.mentioned && (c.mentionCount || 0) > mentionedQueries)
    .sort((a, b) => (b.mentionCount || 0) - (a.mentionCount || 0))
    .slice(0, 3)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Eye className="size-5 text-blue-500" />
        <h3 className="text-base font-bold text-gray-900">Visibility Breakdown</h3>
      </div>

      <p className="text-sm text-gray-600">
        {mentionedQueries > 0 ? (
          <>
            <span className="font-semibold text-gray-900">{brandName}</span> appeared in{" "}
            <span className="font-semibold text-blue-600">
              {mentionedQueries} of {totalQueries}
            </span>{" "}
            AI responses.
          </>
        ) : (
          <>
            <span className="font-semibold text-gray-900">{brandName}</span> did not appear
            in any of the <span className="font-semibold">{totalQueries}</span> AI responses we tested.
          </>
        )}
      </p>

      {topCompetitors.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <p className="text-sm font-medium text-red-800 mb-2">
            Competitors appearing more often:
          </p>
          <ul className="space-y-1">
            {topCompetitors.map((c) => (
              <li
                key={c.name}
                className="text-sm text-red-700 flex items-center justify-between"
              >
                <span className="font-medium">{c.name}</span>
                <span className="text-xs text-red-500 bg-red-100 px-2 py-0.5 rounded-full">
                  {c.mentionCount} mentions
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function QuickWinOpportunities({
  missedQueries,
  isFreePlan,
  onUpgrade,
}: {
  missedQueries: MissedQuery[]
  isFreePlan: boolean
  onUpgrade: () => void
}) {
  if (missedQueries.length === 0) return null

  const topMissed = missedQueries.slice(0, 3)

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Zap className="size-5 text-amber-600" />
        <h3 className="text-base font-bold text-gray-900">Quick Win Opportunities</h3>
      </div>

      <p className="text-sm text-gray-700">
        You are missing visibility in{" "}
        <span className="font-bold text-amber-700">{missedQueries.length}</span> high-intent
        AI queries.
      </p>

      <div className="space-y-2">
        {topMissed.map((mq, i) => (
          <div
            key={i}
            className="bg-white/70 border border-amber-100 rounded-lg px-3.5 py-2.5 flex items-start gap-2.5"
          >
            <Search className="size-4 text-amber-500 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm text-gray-800 font-medium leading-snug">
                &ldquo;{mq.query}&rdquo;
              </p>
              {mq.competitorsMentioned.length > 0 && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {mq.competitorsMentioned.slice(0, 2).join(", ")} appeared instead
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {missedQueries.length > 3 && (
        <button
          onClick={isFreePlan ? onUpgrade : undefined}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition",
            isFreePlan
              ? "bg-amber-600 hover:bg-amber-700 text-white"
              : "bg-white border border-amber-200 text-amber-700 hover:bg-amber-50"
          )}
        >
          {isFreePlan ? (
            <>
              <Lock className="size-3.5" />
              See All {missedQueries.length} Opportunity Queries
            </>
          ) : (
            <>
              See All {missedQueries.length} Opportunity Queries
              <ArrowRight className="size-3.5" />
            </>
          )}
        </button>
      )}
    </div>
  )
}

function HighOpportunityQueries({
  missedQueries,
  isFreePlan,
  onUpgrade,
}: {
  missedQueries: MissedQuery[]
  isFreePlan: boolean
  onUpgrade: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const queriesWithCompetitors = missedQueries.filter(
    (mq) => mq.competitorsMentioned.length > 0
  )

  if (queriesWithCompetitors.length === 0) return null

  const visibleLimit = isFreePlan ? 3 : expanded ? queriesWithCompetitors.length : 5
  const visible = queriesWithCompetitors.slice(0, visibleLimit)
  const hasMore = queriesWithCompetitors.length > visibleLimit

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Target className="size-5 text-purple-500" />
        <h3 className="text-base font-bold text-gray-900">
          High Opportunity Queries
        </h3>
        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
          {queriesWithCompetitors.length}
        </span>
      </div>

      <p className="text-sm text-gray-600">
        Queries where competitors appeared but you didn&apos;t — your biggest growth opportunities.
      </p>

      <div className="space-y-2">
        {visible.map((mq, i) => (
          <div
            key={i}
            className="border border-gray-200 rounded-xl p-3.5 hover:border-gray-300 transition"
          >
            <p className="text-sm font-medium text-gray-900">&ldquo;{mq.query}&rdquo;</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {mq.competitorsMentioned.map((comp) => (
                <span
                  key={comp}
                  className="text-[11px] bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded-full"
                >
                  {comp}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {isFreePlan && queriesWithCompetitors.length > 3 && (
        <button
          onClick={onUpgrade}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium text-gray-700 transition"
        >
          <Lock className="size-3.5" />
          Unlock {queriesWithCompetitors.length - 3} more queries
        </button>
      )}

      {!isFreePlan && hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition py-1"
        >
          {expanded ? (
            <>
              Show less <ChevronUp className="size-3.5" />
            </>
          ) : (
            <>
              Show all {queriesWithCompetitors.length} queries{" "}
              <ChevronDown className="size-3.5" />
            </>
          )}
        </button>
      )}
    </div>
  )
}

function ImprovementSuggestions({
  suggestions,
  isFreePlan,
  onUpgrade,
}: {
  suggestions: string[]
  isFreePlan: boolean
  onUpgrade: () => void
}) {
  if (suggestions.length === 0) return null

  const visibleLimit = isFreePlan ? 2 : suggestions.length
  const visible = suggestions.slice(0, visibleLimit)
  const locked = isFreePlan && suggestions.length > 2

  const ICONS = [Lightbulb, FileText, BarChart3, Sparkles, Target, Zap]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Lightbulb className="size-5 text-green-500" />
        <h3 className="text-base font-bold text-gray-900">
          How to Improve Your AI Visibility
        </h3>
      </div>

      <div className="space-y-2.5">
        {visible.map((suggestion, i) => {
          const Icon = ICONS[i % ICONS.length]
          return (
            <div
              key={i}
              className="flex items-start gap-3 bg-green-50 border border-green-100 rounded-xl p-3.5"
            >
              <div className="shrink-0 w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center">
                <Icon className="size-3.5 text-green-600" />
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{suggestion}</p>
            </div>
          )
        })}
      </div>

      {locked && (
        <button
          onClick={onUpgrade}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium text-gray-700 transition"
        >
          <Lock className="size-3.5" />
          Unlock {suggestions.length - 2} more strategies
        </button>
      )}
    </div>
  )
}

function UpgradeTrigger({
  brandName,
  mentionedCount,
  totalCount,
  onUpgrade,
}: {
  brandName: string
  mentionedCount: number
  totalCount: number
  onUpgrade: () => void
}) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white">
      <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

      <div className="relative z-10 space-y-4">
        <p className="text-lg font-bold">
          {brandName} appeared in {mentionedCount} / {totalCount} AI responses.
        </p>
        <p className="text-sm text-blue-100">
          Unlock the full report to see:
        </p>
        <ul className="space-y-2">
          {[
            "All opportunity queries",
            "Competitor visibility gaps",
            "AI citation opportunities",
            "Full improvement strategy",
          ].map((item) => (
            <li key={item} className="flex items-center gap-2 text-sm text-blue-50">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-300 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
        <button
          onClick={onUpgrade}
          className="w-full bg-white text-blue-700 font-bold px-6 py-3 rounded-xl hover:bg-blue-50 transition text-sm"
        >
          Unlock Full AI Visibility Report
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function PostScanActionPanel({
  brandName,
  score,
  mentionRate,
  queries,
  competitors,
  rawResponses,
  isFreePlan,
  onUpgrade,
}: PostScanActionPanelProps) {
  const missedQueries = getMissedQueries(queries, rawResponses, competitors)
  const suggestions = generateSuggestions(missedQueries, competitors, score, brandName)

  const totalQueries = queries.length
  const mentionedQueries = queries.filter((q) => q.chatgpt || q.claude).length

  if (totalQueries === 0) return null

  const queriesWithCompetitors = missedQueries.filter(
    (mq) => mq.competitorsMentioned.length > 0
  )
  const hasMissed = missedQueries.length > 0
  const hasHighOpp = queriesWithCompetitors.length > 0
  const hasSuggestions = suggestions.length > 0

  return (
    <section>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
        {/* 1. Visibility Breakdown */}
        <div className="p-6">
          <VisibilityBreakdown
            brandName={brandName}
            queries={queries}
            competitors={competitors}
          />
        </div>

        {/* 2. Quick Win Opportunities */}
        {hasMissed && (
          <div className="p-6 border-t border-gray-100">
            <QuickWinOpportunities
              missedQueries={missedQueries}
              isFreePlan={isFreePlan}
              onUpgrade={onUpgrade}
            />
          </div>
        )}

        {/* 3. High Opportunity Queries */}
        {hasHighOpp && (
          <div className="p-6 border-t border-gray-100">
            <HighOpportunityQueries
              missedQueries={missedQueries}
              isFreePlan={isFreePlan}
              onUpgrade={onUpgrade}
            />
          </div>
        )}

        {/* 4. Improvement Suggestions */}
        {hasSuggestions && (
          <div className="p-6 border-t border-gray-100">
            <ImprovementSuggestions
              suggestions={suggestions}
              isFreePlan={isFreePlan}
              onUpgrade={onUpgrade}
            />
          </div>
        )}

        {/* 5. Upgrade Trigger (free plan only) */}
        {isFreePlan && (
          <div className="p-6 border-t border-gray-100">
            <UpgradeTrigger
              brandName={brandName}
              mentionedCount={mentionedQueries}
              totalCount={totalQueries}
              onUpgrade={onUpgrade}
            />
          </div>
        )}
      </div>
    </section>
  )
}
