'use client'

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { getProviderMeta } from "@/lib/provider-colors"
import { ScoreDelta } from "@/app/dashboard/components/score-delta"

export interface ProviderCompetitor {
  name: string
  mention_rate: number
  avg_position: number
  position_delta: number
}

export interface ProviderCardProps {
  provider: string
  composite_score: number
  mention_rate: number
  avg_position: number
  sentiment_avg: number
  category_coverage: number
  mentions_count: number
  total_queries: number
  top_competitors?: ProviderCompetitor[]
  scoreDelta?: number | null
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-status-success"
  if (score >= 50) return "text-[#10B981]"
  if (score >= 30) return "text-status-warning"
  if (score > 0) return "text-orange-500"
  return "text-status-error"
}

function scoreBg(score: number): string {
  if (score >= 70) return "bg-status-success"
  if (score >= 50) return "bg-[#10B981]"
  if (score >= 30) return "bg-status-warning"
  if (score > 0) return "bg-orange-500"
  return "bg-status-error"
}

function sentimentLabel(avg: number): { text: string; color: string } {
  if (avg > 0) return { text: "Positive", color: "text-green-600 font-medium" }
  if (avg < 0) return { text: "Negative", color: "text-red-600 font-medium" }
  return { text: "Neutral", color: "text-gray-500" }
}

export function ProviderCard(props: ProviderCardProps) {
  const [showCompetitors, setShowCompetitors] = useState(false)

  const meta = getProviderMeta(props.provider)

  const sentiment = sentimentLabel(props.sentiment_avg)
  const mentionPct = Math.round(props.mention_rate * 100)
  const coveragePct = Math.round(props.category_coverage * 100)

  return (
    <div className="bg-background border border-gray-200 rounded-xl p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={cn("size-9 rounded-xl flex items-center justify-center", meta.lightBg)}>
            <span className={cn("text-base font-bold", meta.color)}>
              {meta.label.charAt(0)}
            </span>
          </div>
          <div>
            <p className="font-medium text-gray-900 text-sm">{meta.label}</p>
          </div>
        </div>
        <span className="text-[10px] px-2 py-0.5 bg-gray-100 rounded-full text-gray-600 font-medium">
          {meta.model}
        </span>
      </div>

      {/* Score */}
      <div className="flex items-end gap-2">
        <span className={cn("text-2xl font-bold leading-none", scoreColor(props.composite_score))}>
          {props.composite_score}
        </span>
        <span className="text-base text-gray-400 mb-0.5">/100</span>
        {props.scoreDelta != null && (
          <span className="mb-0.5">
            <ScoreDelta delta={props.scoreDelta} suffix=" pts" />
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", scoreBg(props.composite_score))}
          style={{ width: `${props.composite_score}%` }}
        />
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Mention rate</p>
          <p className="text-sm font-bold text-gray-900">{mentionPct}%</p>
          <p className="text-[10px] text-gray-500">
            {props.mentions_count}/{props.total_queries} queries
          </p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Avg position</p>
          <p className="text-sm font-bold text-gray-900">
            {props.avg_position > 0 ? `#${props.avg_position}` : "N/A"}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Sentiment</p>
          <p className={cn("text-sm font-medium", sentiment.color)}>{sentiment.text}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Category coverage</p>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", meta.bgColor)}
                style={{ width: `${coveragePct}%` }}
              />
            </div>
            <span className="text-xs font-medium text-foreground">{coveragePct}%</span>
          </div>
        </div>
      </div>

      {/* Competitor table */}
      {props.top_competitors && props.top_competitors.length > 0 && (
        <div className="border-t border-border pt-3">
          <button
            onClick={() => setShowCompetitors(!showCompetitors)}
            className="w-full flex items-center justify-between text-left group"
          >
            <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
              Top competitors
            </span>
            <ChevronDown className={cn(
              "size-3.5 text-muted-foreground transition-transform",
              showCompetitors && "rotate-180"
            )} />
          </button>

          {showCompetitors && (
            <table className="w-full mt-3 text-xs">
              <thead>
                <tr className="text-muted-foreground text-left">
                  <th className="pb-2 font-medium">Competitor</th>
                  <th className="pb-2 font-medium text-right">Mention&nbsp;rate</th>
                  <th className="pb-2 font-medium text-right">Avg&nbsp;pos</th>
                  <th className="pb-2 font-medium text-right">Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {props.top_competitors.map((c) => (
                  <tr key={c.name}>
                    <td className="py-2 font-medium text-foreground">{c.name}</td>
                    <td className="py-2 text-right text-foreground">{Math.round(c.mention_rate * 100)}%</td>
                    <td className="py-2 text-right text-foreground">
                      {c.avg_position > 0 ? `#${c.avg_position}` : "—"}
                    </td>
                    <td className="py-2 text-right">
                      {c.position_delta !== 0 ? (
                        <span className={cn(
                          "inline-flex items-center gap-0.5 font-medium",
                          c.position_delta > 0 ? "text-status-success" : "text-status-error"
                        )}>
                          {c.position_delta > 0 ? "▲" : "▼"}
                          {Math.abs(c.position_delta)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
