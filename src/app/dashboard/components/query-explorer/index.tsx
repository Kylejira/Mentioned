'use client'

import { useState } from 'react'
import { QueryResultCard } from './query-result-card'

interface QueryData {
  query: string
  chatgpt: boolean
  claude: boolean
  gemini?: boolean
  isCustom?: boolean
}

interface RawResponse {
  query: string
  chatgpt_response?: string | null
  claude_response?: string | null
  gemini_response?: string | null
}

interface Props {
  brandName: string
  queries: QueryData[]
  rawResponses: RawResponse[]
  rawQueriesTested?: any[]
  rawRawResponses?: any[]
}

export function QueryExplorer({ brandName, queries, rawResponses, rawQueriesTested, rawRawResponses }: Props) {
  const [isOpen, setIsOpen] = useState(true)
  const [providerFilter, setProviderFilter] = useState('all')
  const [mentionedOnly, setMentionedOnly] = useState(false)

  // Use transformed queries first, fall back to raw data from scan result
  let effectiveQueries = queries
  let effectiveResponses = rawResponses

  if ((!effectiveQueries || effectiveQueries.length === 0) && rawQueriesTested && Array.isArray(rawQueriesTested) && rawQueriesTested.length > 0) {
    effectiveQueries = rawQueriesTested.map((q: any) => ({
      query: q.query || q,
      chatgpt: q.chatgpt ?? q.chatGPT ?? false,
      claude: q.claude ?? q.Claude ?? false,
      gemini: q.gemini ?? false,
      isCustom: q.isCustom || false,
    }))
  }

  if ((!effectiveResponses || effectiveResponses.length === 0) && rawRawResponses && Array.isArray(rawRawResponses)) {
    effectiveResponses = rawRawResponses
  }

  if (!effectiveQueries || effectiveQueries.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition rounded-2xl"
        >
          <div>
            <h3 className="text-sm font-bold text-gray-900">Query Details</h3>
            <p className="text-xs text-gray-400 mt-0.5">See every query sent to AI models and their responses</p>
          </div>
          <span className="text-xs text-gray-400 font-medium">{isOpen ? '▲ Hide' : '▼ Show'}</span>
        </button>
        {isOpen && (
          <div className="border-t border-gray-100 p-10 text-center">
            <div className="text-2xl mb-2">&#128269;</div>
            <p className="text-sm font-medium text-gray-700 mb-1">No query data for this scan</p>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              Run a new scan to see the full breakdown of every query and AI response.
            </p>
            <a
              href="/check"
              className="mt-4 inline-block bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition"
            >
              Run new scan
            </a>
          </div>
        )}
      </div>
    )
  }

  // Build response lookup by query text
  const responseLookup = new Map<string, RawResponse>()
  for (const r of (effectiveResponses || [])) {
    if (r.query) responseLookup.set(r.query, r)
  }

  // Transform into per-provider result rows
  const providers = [
    { key: 'chatgpt', provider: 'openai', model: 'GPT-4o', label: 'ChatGPT' },
    { key: 'claude', provider: 'anthropic', model: 'Claude', label: 'Claude' },
    { key: 'gemini', provider: 'gemini', model: 'Gemini', label: 'Gemini' },
  ]

  const allResults: Array<{
    id: string
    query_text: string
    query_category: string | null
    provider: string
    model: string
    brand_mentioned: boolean
    brand_position: number | null
    brand_sentiment: string | null
    competitors_detected: any[]
    response_text: string | null
    latency_ms: number | null
  }> = []

  const activeProviders = new Set<string>()

  for (const q of effectiveQueries) {
    const raw = responseLookup.get(q.query)

    for (const p of providers) {
      const mentioned = (q as any)[p.key]
      const responseText = raw ? (raw as any)[`${p.key}_response`] : null

      if (mentioned === undefined && !responseText) continue

      activeProviders.add(p.provider)
      allResults.push({
        id: `${q.query}-${p.provider}`,
        query_text: q.query,
        query_category: null,
        provider: p.provider,
        model: p.model,
        brand_mentioned: !!mentioned,
        brand_position: null,
        brand_sentiment: null,
        competitors_detected: [],
        response_text: responseText || null,
        latency_ms: null,
      })
    }
  }

  let filtered = allResults
  if (providerFilter !== 'all') filtered = filtered.filter(r => r.provider === providerFilter)
  if (mentionedOnly) filtered = filtered.filter(r => r.brand_mentioned)

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition rounded-2xl"
      >
        <div>
          <h3 className="text-sm font-bold text-gray-900">Query Details</h3>
          <p className="text-xs text-gray-400 mt-0.5">See every query sent to AI models and their responses</p>
        </div>
        <span className="text-xs text-gray-400 font-medium">{isOpen ? '▲ Hide' : '▼ Show'}</span>
      </button>

      {isOpen && (
        <div className="border-t border-gray-100">
          {/* Filters */}
          <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              {['all', ...[...activeProviders]].map((prov: string) => (
                <button
                  key={prov}
                  onClick={() => setProviderFilter(prov)}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition ${
                    providerFilter === prov
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {prov === 'all' ? 'All' : prov === 'openai' ? 'ChatGPT' : prov === 'anthropic' ? 'Claude' : prov === 'gemini' ? 'Gemini' : prov}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={mentionedOnly}
                onChange={e => setMentionedOnly(e.target.checked)}
                className="rounded border-gray-300"
              />
              Mentioned only
            </label>

            <span className="text-xs text-gray-400 ml-auto">
              Showing {filtered.length} of {allResults.length}
            </span>
          </div>

          {/* Results list */}
          <div className="max-h-[600px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-gray-500 mb-1">No queries match your filters</p>
                <button
                  onClick={() => { setProviderFilter('all'); setMentionedOnly(false) }}
                  className="text-xs text-blue-600 font-medium hover:text-blue-700"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              filtered.map((result) => (
                <QueryResultCard key={result.id} result={result} brandName={brandName} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
