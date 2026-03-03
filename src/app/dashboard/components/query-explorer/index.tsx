'use client'

import { useState, useEffect } from 'react'
import { QueryResultCard } from './query-result-card'

interface Props {
  scanId: string | null
  brandName: string
}

export function QueryExplorer({ scanId, brandName }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState(false)
  const [providerFilter, setProviderFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [mentionedOnly, setMentionedOnly] = useState(false)

  useEffect(() => {
    setData(null)
    setError(false)
    setProviderFilter('all')
    setCategoryFilter('all')
    setMentionedOnly(false)
  }, [scanId])

  useEffect(() => {
    if (isOpen && scanId && !data && !error) {
      setLoading(true)
      fetch(`/api/scan/${scanId}/queries`)
        .then(res => {
          if (!res.ok) {
            if (res.status === 403 || res.status === 404) {
              return { total: 0, results: [], filters: { providers: [], categories: [] } }
            }
            throw new Error(`${res.status}`)
          }
          return res.json()
        })
        .then(d => { setData(d); setLoading(false) })
        .catch(() => { setError(true); setLoading(false) })
    }
  }, [isOpen, scanId, data, error])

  if (!scanId) return null

  const hasResults = data && data.total > 0
  let filtered = data?.results || []
  if (providerFilter !== 'all') filtered = filtered.filter((r: any) => r.provider === providerFilter)
  if (categoryFilter !== 'all') filtered = filtered.filter((r: any) => r.query_category === categoryFilter)
  if (mentionedOnly) filtered = filtered.filter((r: any) => r.brand_mentioned)

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
          {loading ? (
            <div className="p-10 text-center">
              <div className="inline-block w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mb-3" />
              <p className="text-sm text-gray-400">Loading query details...</p>
            </div>
          ) : error ? (
            <div className="p-10 text-center">
              <div className="text-2xl mb-2">&#9888;&#65039;</div>
              <p className="text-sm font-medium text-gray-700 mb-1">Couldn&apos;t load query details</p>
              <p className="text-xs text-gray-400 mb-4">This scan may not have detailed query data available.</p>
              <button
                onClick={() => { setError(false); setData(null) }}
                className="text-xs text-blue-600 font-medium hover:text-blue-700"
              >
                Try again
              </button>
            </div>
          ) : !hasResults ? (
            <div className="p-10 text-center">
              <div className="text-2xl mb-2">&#128269;</div>
              <p className="text-sm font-medium text-gray-700 mb-1">No query data for this scan</p>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                Detailed query results are available on scans run after this feature was added. Run a new scan to see the full breakdown of every query and AI response.
              </p>
              <a
                href="/check"
                className="mt-4 inline-block bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition"
              >
                Run new scan
              </a>
            </div>
          ) : (
            <>
              {/* Filters */}
              <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1">
                  {['all', ...(data?.filters?.providers || [])].map((prov: string) => (
                    <button
                      key={prov}
                      onClick={() => setProviderFilter(prov)}
                      className={`text-xs px-2.5 py-1 rounded-md font-medium transition ${
                        providerFilter === prov
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {prov === 'all' ? 'All' : prov === 'openai' ? 'ChatGPT' : prov === 'anthropic' ? 'Claude' : prov}
                    </button>
                  ))}
                </div>

                {data?.filters?.categories?.length > 0 && (
                  <select
                    value={categoryFilter}
                    onChange={e => setCategoryFilter(e.target.value)}
                    className="text-xs border border-gray-200 rounded-md px-2 py-1 text-gray-600"
                  >
                    <option value="all">All categories</option>
                    {data.filters.categories.map((cat: string) => (
                      <option key={cat} value={cat}>{cat.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                )}

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
                  Showing {filtered.length} of {data?.total || 0}
                </span>
              </div>

              {/* Results list */}
              <div className="max-h-[600px] overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm text-gray-500 mb-1">No queries match your filters</p>
                    <button
                      onClick={() => { setProviderFilter('all'); setCategoryFilter('all'); setMentionedOnly(false) }}
                      className="text-xs text-blue-600 font-medium hover:text-blue-700"
                    >
                      Clear filters
                    </button>
                  </div>
                ) : (
                  filtered.map((result: any) => (
                    <QueryResultCard key={result.id} result={result} brandName={brandName} />
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
