'use client'

import { Info } from "lucide-react"

interface ProviderInsightsProps {
  insights: string[]
}

export function ProviderInsights({ insights }: ProviderInsightsProps) {
  if (!insights || insights.length === 0) return null

  return (
    <div className="space-y-2">
      {insights.slice(0, 4).map((insight, i) => (
        <div
          key={i}
          className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/30 px-4 py-3"
        >
          <Info className="size-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-sm text-foreground">{insight}</p>
        </div>
      ))}
    </div>
  )
}
