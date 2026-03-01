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
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: meta.hex }}>
            {meta.icon}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{meta.label}</p>
            <p className="text-xs text-gray-400 font-mono">{meta.model}</p>
          </div>
        </div>
        <span className="text-[10px] px-2 py-0.5 bg-gray-100 rounded-full text-gray-500">
          {meta.model}
        </span>
      </div>

      {/* Score */}
      <div className="flex items-end gap-2 mt-1">
        <span className={cn("text-4xl font-extrabold leading-none", scoreColor(props.composite_score))}>
          {props.composite_score}
        </span>
        <span className="text-lg text-gray-300 font-medium mb-0.5">/100</span>
        {props.scoreDelta != null && (
          <span className="mb-0.5">
            <ScoreDelta delta={props.scoreDelta} suffix=" pts" />
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-gray-100 rounded-full">
        <div
          className={cn("h-2 rounded-full transition-all", scoreBg(props.composite_score))}
          style={{ width: `${Math.max(props.composite_score, 1)}%` }}
        />
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-4 mt-5">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Mention Rate</div>
          <div className="text-lg font-bold text-gray-900 mt-0.5">{mentionPct}%</div>
          <div className="text-[10px] text-gray-400">{props.mentions_count}/{props.total_queries} queries</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Avg Position</div>
          <div className="text-lg font-bold text-gray-900 mt-0.5">
            {props.avg_position > 0 ? `#${props.avg_position}` : "N/A"}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Sentiment</div>
          <div className={cn("text-sm mt-0.5", sentiment.color)}>{sentiment.text}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Category Coverage</div>
          <div className="text-lg font-bold text-gray-900 mt-0.5">{coveragePct}%</div>
        </div>
      </div>

      {/* Category coverage bar */}
      <div className="mt-1">
        <div className="flex justify-between text-[10px] text-gray-400 mb-1">
          <span>Category Coverage</span>
          <span>{coveragePct}%</span>
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full">
          <div className="h-1.5 bg-blue-500 rounded-full" style={{ width: `${coveragePct}%` }} />
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
