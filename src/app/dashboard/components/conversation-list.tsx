'use client'

import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { ScoreBadge, type OpportunityTier, type OpportunitySignals } from "./score-badge"
import {
  ChevronDown,
  Loader2,
  ExternalLink,
  MessageSquare,
  ArrowUpDown,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Conversation {
  id: string
  text: string
  title?: string
  url?: string
  platform: string
  posted_at: string
  author?: string
  engagement: Record<string, number>
  opportunity_score: number
  opportunity_tier: OpportunityTier
  opportunity_signals: OpportunitySignals
  opportunity_reasons: string[]
  replied_at?: string | null
}

interface TierCounts {
  hot: number
  strong: number
  moderate: number
  low: number
  cold: number
}

type SortField = "opportunity_score" | "posted_at"

// ---------------------------------------------------------------------------
// Sort options
// ---------------------------------------------------------------------------

const SORT_OPTIONS: Array<{ label: string; value: SortField; dir: "desc" | "asc" }> = [
  { label: "Opportunity Score", value: "opportunity_score", dir: "desc" },
  { label: "Most Recent", value: "posted_at", dir: "desc" },
]

// ---------------------------------------------------------------------------
// Tier filter config
// ---------------------------------------------------------------------------

const TIER_CONFIG: Record<OpportunityTier, { label: string; classes: string; activeClasses: string }> = {
  hot: {
    label: "Hot",
    classes: "text-red-600 bg-white border-gray-200 hover:border-red-300",
    activeClasses: "bg-red-50 border-red-300 text-red-700",
  },
  strong: {
    label: "Strong",
    classes: "text-amber-600 bg-white border-gray-200 hover:border-amber-300",
    activeClasses: "bg-amber-50 border-amber-300 text-amber-700",
  },
  moderate: {
    label: "Moderate",
    classes: "text-blue-600 bg-white border-gray-200 hover:border-blue-300",
    activeClasses: "bg-blue-50 border-blue-300 text-blue-700",
  },
  low: {
    label: "Low",
    classes: "text-gray-500 bg-white border-gray-200 hover:border-gray-300",
    activeClasses: "bg-gray-100 border-gray-300 text-gray-600",
  },
  cold: {
    label: "Cold",
    classes: "text-gray-400 bg-white border-gray-200 hover:border-gray-200",
    activeClasses: "bg-gray-50 border-gray-300 text-gray-500",
  },
}

// ---------------------------------------------------------------------------
// Platform display
// ---------------------------------------------------------------------------

function formatPlatform(platform: string): string {
  const map: Record<string, string> = {
    reddit: "Reddit",
    twitter: "Twitter/X",
    hackernews: "Hacker News",
    producthunt: "Product Hunt",
    quora: "Quora",
    discourse: "Discourse",
  }
  return map[platform.toLowerCase()] || platform
}

function timeAgo(dateStr: string): string {
  const hours = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60)
  if (hours < 1) return "just now"
  if (hours < 24) return `${Math.round(hours)}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.round(days / 7)}w ago`
  return `${Math.round(days / 30)}mo ago`
}

// ---------------------------------------------------------------------------
// ConversationList
// ---------------------------------------------------------------------------

export function ConversationList() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [tierCounts, setTierCounts] = useState<TierCounts>({ hot: 0, strong: 0, moderate: 0, low: 0, cold: 0 })
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const [sortOption, setSortOption] = useState(SORT_OPTIONS[0])
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [activeTiers, setActiveTiers] = useState<Set<OpportunityTier>>(new Set())

  const fetchConversations = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        sort: sortOption.value,
        dir: sortOption.dir,
        limit: "50",
      })
      if (activeTiers.size > 0) {
        params.set("tiers", [...activeTiers].join(","))
      }

      const res = await fetch(`/api/conversations?${params}`)
      if (!res.ok) throw new Error("Failed to fetch")

      const data = await res.json()
      setConversations(data.conversations)
      setTotal(data.total)
      setTierCounts(data.tier_counts)
    } catch {
      // non-fatal
    } finally {
      setIsLoading(false)
    }
  }, [sortOption, activeTiers])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  const toggleTier = (tier: OpportunityTier) => {
    setActiveTiers((prev) => {
      const next = new Set(prev)
      if (next.has(tier)) {
        next.delete(tier)
      } else {
        next.add(tier)
      }
      return next
    })
  }

  const totalConversations = Object.values(tierCounts).reduce((a, b) => a + b, 0)

  return (
    <div>
      {/* Header with sort */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <MessageSquare className="size-5 text-blue-500" />
          Discovered Conversations
          {totalConversations > 0 && (
            <span className="text-sm font-normal text-gray-400 ml-1">
              ({totalConversations})
            </span>
          )}
        </h2>

        {/* Sort dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
          >
            <ArrowUpDown className="size-3.5" />
            {sortOption.label}
            <ChevronDown className="size-3.5" />
          </button>
          {showSortMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl border border-gray-200 shadow-lg py-1 min-w-[180px]">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setSortOption(opt)
                      setShowSortMenu(false)
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm transition",
                      opt.value === sortOption.value
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tier filter chips */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <button
          onClick={() => setActiveTiers(new Set())}
          className={cn(
            "text-sm font-medium px-3 py-1.5 rounded-full border transition",
            activeTiers.size === 0
              ? "bg-gray-900 text-white border-gray-900"
              : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
          )}
        >
          All ({totalConversations})
        </button>
        {(Object.keys(TIER_CONFIG) as OpportunityTier[]).map((tier) => {
          const config = TIER_CONFIG[tier]
          const count = tierCounts[tier] || 0
          if (count === 0) return null
          const isActive = activeTiers.has(tier)
          return (
            <button
              key={tier}
              onClick={() => toggleTier(tier)}
              className={cn(
                "text-sm font-medium px-3 py-1.5 rounded-full border transition",
                isActive ? config.activeClasses : config.classes
              )}
            >
              {config.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Conversation list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 text-gray-400 animate-spin" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500">
            {activeTiers.size > 0
              ? "No conversations match the selected filters."
              : "No conversations discovered yet. Run a scan to find opportunities."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {conversations.map((conv) => (
            <ConversationRow key={conv.id} conversation={conv} />
          ))}

          {total > conversations.length && (
            <p className="text-center text-sm text-gray-400 pt-2">
              Showing {conversations.length} of {total} conversations
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ConversationRow
// ---------------------------------------------------------------------------

function ConversationRow({ conversation: conv }: { conversation: Conversation }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 hover:border-gray-300 transition flex gap-4 items-start">
      {/* Score badge */}
      <ScoreBadge
        score={conv.opportunity_score}
        tier={conv.opportunity_tier}
        signals={conv.opportunity_signals}
        reasons={conv.opportunity_reasons}
        className="shrink-0"
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        {conv.title && (
          <h4 className="text-sm font-semibold text-gray-900 truncate mb-0.5">
            {conv.title}
          </h4>
        )}
        <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
          {conv.text}
        </p>

        <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-400">
          <span className="font-medium text-gray-500">
            {formatPlatform(conv.platform)}
          </span>
          <span>{timeAgo(conv.posted_at)}</span>
          {conv.author && <span>by {conv.author}</span>}
          {conv.replied_at && (
            <span className="text-green-600 font-medium">Replied</span>
          )}
        </div>
      </div>

      {/* External link */}
      {conv.url && (
        <a
          href={conv.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-gray-300 hover:text-blue-500 transition"
        >
          <ExternalLink className="size-4" />
        </a>
      )}
    </div>
  )
}
