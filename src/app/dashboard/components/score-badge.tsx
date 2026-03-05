'use client'

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OpportunityTier = "hot" | "strong" | "moderate" | "low" | "cold"

export interface OpportunitySignals {
  intent: number
  keyword_match: number
  engagement: number
  recency: number
  competition: number
  platform: number
}

export interface ScoreBadgeProps {
  score: number
  tier: OpportunityTier
  signals?: OpportunitySignals
  reasons?: string[]
  className?: string
}

// ---------------------------------------------------------------------------
// Tier styling
// ---------------------------------------------------------------------------

const TIER_STYLES: Record<OpportunityTier, { badge: string; label: string; bar: string }> = {
  hot: {
    badge: "bg-red-50 border-red-200 text-red-700",
    label: "HOT",
    bar: "bg-red-500",
  },
  strong: {
    badge: "bg-amber-50 border-amber-200 text-amber-700",
    label: "STRONG",
    bar: "bg-amber-500",
  },
  moderate: {
    badge: "bg-blue-50 border-blue-200 text-blue-700",
    label: "MODERATE",
    bar: "bg-blue-500",
  },
  low: {
    badge: "bg-gray-50 border-gray-200 text-gray-500",
    label: "LOW",
    bar: "bg-gray-400",
  },
  cold: {
    badge: "bg-gray-50 border-gray-100 text-gray-400",
    label: "COLD",
    bar: "bg-gray-300",
  },
}

// ---------------------------------------------------------------------------
// Signal config for the tooltip breakdown
// ---------------------------------------------------------------------------

const SIGNAL_CONFIG: Array<{
  key: keyof OpportunitySignals
  label: string
  max: number
  color: string
}> = [
  { key: "intent", label: "Intent Strength", max: 30, color: "bg-red-500" },
  { key: "keyword_match", label: "Keyword Match", max: 25, color: "bg-blue-500" },
  { key: "engagement", label: "Engagement", max: 15, color: "bg-emerald-500" },
  { key: "recency", label: "Recency", max: 15, color: "bg-purple-500" },
  { key: "competition", label: "Low Competition", max: 10, color: "bg-amber-500" },
  { key: "platform", label: "Platform", max: 5, color: "bg-gray-500" },
]

// ---------------------------------------------------------------------------
// ScoreBadge
// ---------------------------------------------------------------------------

export function ScoreBadge({ score, tier, signals, reasons, className }: ScoreBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipPos, setTooltipPos] = useState<"bottom" | "top">("bottom")
  const badgeRef = useRef<HTMLDivElement>(null)
  const style = TIER_STYLES[tier] || TIER_STYLES.cold

  useEffect(() => {
    if (showTooltip && badgeRef.current) {
      const rect = badgeRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      setTooltipPos(spaceBelow < 280 ? "top" : "bottom")
    }
  }, [showTooltip])

  return (
    <div
      ref={badgeRef}
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Badge */}
      <div
        className={cn(
          "flex flex-col items-center justify-center px-2.5 py-1.5 rounded-xl border text-center min-w-[52px] cursor-default select-none transition",
          style.badge
        )}
      >
        <span className="text-lg font-bold leading-none">{score}</span>
        <span className="text-[9px] font-semibold tracking-wider leading-none mt-0.5">
          {style.label}
        </span>
      </div>

      {/* Tooltip */}
      {showTooltip && signals && (
        <div
          className={cn(
            "absolute z-50 w-72 bg-white rounded-xl border border-gray-200 shadow-xl p-4",
            "animate-in fade-in-0 zoom-in-95 duration-150",
            tooltipPos === "bottom"
              ? "top-full mt-2 left-1/2 -translate-x-1/2"
              : "bottom-full mb-2 left-1/2 -translate-x-1/2"
          )}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-gray-900">
              Opportunity Score: {score}/100
            </span>
            <span
              className={cn(
                "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                style.badge
              )}
            >
              {style.label}
            </span>
          </div>

          {/* Signal bars */}
          <div className="space-y-2">
            {SIGNAL_CONFIG.map((sig) => {
              const value = signals[sig.key]
              const pct = Math.round((value / sig.max) * 100)
              return (
                <div key={sig.key}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[11px] text-gray-600">{sig.label}</span>
                    <span className="text-[11px] text-gray-400 tabular-nums">
                      {value}/{sig.max}
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", sig.color)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Reasons */}
          {reasons && reasons.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1.5">
                Why this scores {tier === "hot" || tier === "strong" ? "high" : tier === "cold" || tier === "low" ? "low" : "here"}
              </p>
              <ul className="space-y-0.5">
                {reasons.map((r, i) => (
                  <li key={i} className="text-[11px] text-gray-600 flex items-start gap-1.5">
                    <span className="text-gray-300 mt-px shrink-0">&bull;</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
