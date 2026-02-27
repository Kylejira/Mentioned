'use client'

import { useState } from 'react'
import { getProviderMeta } from '@/lib/provider-colors'
import type { ProviderScore } from '@/lib/scan-v3/scoring/types'

export interface TrendPoint {
  date: string
  overall_score: number
  mention_rate: number
  consistency_score: number
  provider_scores: ProviderScore[]
}

interface VisibilityGraphProps {
  points: TrendPoint[]
  showProviders?: boolean
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function buildCurve(
  data: { x: number; y: number }[]
): string {
  return data.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`
    const prev = data[i - 1]
    const cx1 = prev.x + (pt.x - prev.x) / 3
    const cx2 = prev.x + ((pt.x - prev.x) * 2) / 3
    return `${acc} C ${cx1} ${prev.y}, ${cx2} ${pt.y}, ${pt.x} ${pt.y}`
  }, '')
}

export function VisibilityGraph({ points, showProviders = false }: VisibilityGraphProps) {
  const [activePoint, setActivePoint] = useState<number | null>(null)
  const [providerLines, setProviderLines] = useState(showProviders)

  if (points.length === 0) {
    return (
      <div className="bg-background border border-border rounded-2xl p-6 text-center">
        <p className="text-muted-foreground text-sm">No scan history yet. Run your first scan to start tracking.</p>
      </div>
    )
  }

  if (points.length === 1) {
    const pt = points[0]
    return (
      <div className="bg-background border border-border rounded-2xl p-6">
        <p className="text-xs text-muted-foreground mb-1">Visibility Score</p>
        <p className="text-4xl font-bold text-foreground">{pt.overall_score}<span className="text-lg text-muted-foreground">/100</span></p>
        <p className="text-xs text-muted-foreground mt-2">Scanned on {formatDate(pt.date)}. Run another scan to see trends.</p>
      </div>
    )
  }

  const scores = points.map((p) => p.overall_score)
  const maxScore = Math.max(...scores, 1)
  const minScore = Math.min(...scores, 0)
  const range = maxScore - minScore || 1

  const W = 100
  const H = 100
  const PAD = 10

  const toXY = (val: number, idx: number) => ({
    x: PAD + (idx / (points.length - 1)) * (W - PAD * 2),
    y: H - PAD - ((val - minScore) / range) * (H - PAD * 2),
  })

  const mainPts = scores.map((s, i) => toXY(s, i))
  const mainPath = buildCurve(mainPts)
  const areaPath = `${mainPath} L ${mainPts[mainPts.length - 1].x} ${H - PAD} L ${PAD} ${H - PAD} Z`

  const providerNames = providerLines
    ? [...new Set(points.flatMap((p) => p.provider_scores.map((ps) => ps.provider)))]
    : []

  const providerPaths = providerNames.map((name) => {
    const pts = points.map((p, i) => {
      const ps = p.provider_scores.find((s) => s.provider === name)
      return toXY(ps?.visibility_score ?? p.overall_score, i)
    })
    return { name, path: buildCurve(pts), hex: getProviderMeta(name).hex }
  })

  const first = points[0].overall_score
  const last = points[points.length - 1].overall_score
  const change = last - first
  const changePct = first > 0 ? Math.round((change / first) * 100) : 0

  return (
    <div className="bg-background border border-border rounded-2xl overflow-hidden">
      <div className="p-4 sm:p-6 pb-2 sm:pb-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Visibility Score</p>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl sm:text-4xl font-bold text-foreground">{last}</span>
              {points.length > 1 && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  change >= 0
                    ? 'bg-status-success-muted text-status-success'
                    : 'bg-status-error-muted text-status-error'
                }`}>
                  {change >= 0 ? '▲' : '▼'} {Math.abs(changePct)}%
                </span>
              )}
            </div>
          </div>
          {providerNames.length > 0 || points[0]?.provider_scores?.length > 0 ? (
            <button
              onClick={() => setProviderLines(!providerLines)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                providerLines
                  ? 'bg-primary/10 border-primary/20 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {providerLines ? 'Hide providers' : 'Show providers'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="relative h-48 sm:h-56 px-4 sm:px-6 pb-4 sm:pb-6">
        <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="trendArea" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </linearGradient>
          </defs>

          {[25, 50, 75].map((y) => (
            <line key={y} x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="hsl(var(--border))" strokeWidth="0.3" strokeDasharray="2,2" />
          ))}

          {!providerLines && <path d={areaPath} fill="url(#trendArea)" />}

          <path d={mainPath} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />

          {providerPaths.map((pp) => (
            <path key={pp.name} d={pp.path} fill="none" stroke={pp.hex} strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4,2" vectorEffect="non-scaling-stroke" />
          ))}

          {mainPts.map((pt, i) => (
            <circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r={activePoint === i ? 4 : 2.5}
              fill="hsl(var(--primary))"
              stroke="hsl(var(--background))"
              strokeWidth="1.5"
              className="cursor-pointer transition-all"
              onMouseEnter={() => setActivePoint(i)}
              onMouseLeave={() => setActivePoint(null)}
            />
          ))}
        </svg>

        {activePoint !== null && (
          <div
            className="absolute bg-popover text-popover-foreground text-xs px-3 py-2 rounded-lg shadow-lg border border-border pointer-events-none -translate-x-1/2 -translate-y-full"
            style={{
              left: `${10 + (activePoint / (points.length - 1)) * 80}%`,
              top: `${H - PAD - ((scores[activePoint] - minScore) / range) * (H - PAD * 2)}%`,
            }}
          >
            <p className="font-semibold">{scores[activePoint]}/100</p>
            <p className="text-muted-foreground">{formatDate(points[activePoint].date)}</p>
          </div>
        )}

        <div className="absolute bottom-0 left-4 right-4 sm:left-6 sm:right-6 flex justify-between text-[10px] text-muted-foreground">
          <span>{formatDate(points[0].date)}</span>
          <span>{formatDate(points[points.length - 1].date)}</span>
        </div>
      </div>

      {providerLines && providerPaths.length > 0 && (
        <div className="px-4 sm:px-6 pb-4 flex flex-wrap gap-3">
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="w-4 h-0.5 rounded-full bg-primary" />
            <span className="text-muted-foreground">Overall</span>
          </div>
          {providerPaths.map((pp) => (
            <div key={pp.name} className="flex items-center gap-1.5 text-[10px]">
              <span className="w-4 h-0.5 rounded-full" style={{ backgroundColor: pp.hex }} />
              <span className="text-muted-foreground">{getProviderMeta(pp.name).label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
