'use client'

import { useState } from 'react'

interface QueryResult {
  id: string
  query_text: string
  query_category: string | null
  provider: string
  model: string
  brand_mentioned: boolean
  brand_position: number | null
  brand_sentiment: string | null
  competitors_detected: any[]
  response_text: string
  latency_ms: number | null
}

interface Props {
  result: QueryResult
  brandName: string
}

const CATEGORY_COLORS: Record<string, string> = {
  buying_intent: 'bg-blue-100 text-blue-700',
  comparison: 'bg-purple-100 text-purple-700',
  best_in_class: 'bg-green-100 text-green-700',
  problem_solving: 'bg-amber-100 text-amber-700',
  recommendation: 'bg-pink-100 text-pink-700',
  direct_recommendation: 'bg-pink-100 text-pink-700',
  alternatives: 'bg-orange-100 text-orange-700',
  feature_based: 'bg-cyan-100 text-cyan-700',
  budget_based: 'bg-teal-100 text-teal-700',
  user_provided: 'bg-indigo-100 text-indigo-700',
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function highlightBrand(text: string, brandName: string): string {
  if (!brandName || !text) return escapeHtml(text || '')

  const sanitized = escapeHtml(text)
  const escapedBrand = escapeHtml(brandName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(\\b${escapedBrand}\\b)`, 'gi')
  return sanitized.replace(regex, '<mark class="bg-yellow-200 px-0.5 rounded font-medium">$1</mark>')
}

export function QueryResultCard({ result, brandName }: Props) {
  const [expanded, setExpanded] = useState(false)

  const categoryColor = CATEGORY_COLORS[result.query_category || ''] || 'bg-gray-100 text-gray-600'

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-3 hover:bg-gray-50 transition text-left"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {result.query_category && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${categoryColor}`}>
              {result.query_category.replace(/_/g, ' ')}
            </span>
          )}
          <span className="text-sm text-gray-900 truncate">{result.query_text}</span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
          <span className="text-[10px] text-gray-400 font-mono">
            {result.provider === 'openai' ? 'ChatGPT' : result.provider === 'anthropic' ? 'Claude' : result.provider}
          </span>
          {result.brand_mentioned ? (
            <span className="text-green-600 text-xs">✓</span>
          ) : (
            <span className="text-red-400 text-xs">✗</span>
          )}
          <span className="text-xs text-gray-500 w-6 text-right">
            {result.brand_position ? `#${result.brand_position}` : '—'}
          </span>
          <span className="text-gray-300 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-4">
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 leading-relaxed">
            <div
              dangerouslySetInnerHTML={{ __html: highlightBrand(result.response_text || '', brandName) }}
            />
          </div>
          <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400">
            <span>{result.provider} / {result.model}</span>
            {result.latency_ms && <span>{(result.latency_ms / 1000).toFixed(1)}s</span>}
            {result.brand_position && <span>Position: #{result.brand_position}</span>}
            {result.brand_sentiment && <span>Sentiment: {result.brand_sentiment}</span>}
          </div>
          {result.competitors_detected?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {result.competitors_detected.map((comp: any, i: number) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                  {comp.name || comp}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
