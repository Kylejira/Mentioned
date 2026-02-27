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
  const [providerFilter, setProviderFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [mentionedOnly, setMentionedOnly] = useState(false)

  useEffect(() => {
    if (isOpen && scanId && !data) {
      setLoading(true)
      fetch(`/api/scan/${scanId}/queries`)
        .then(res => res.json())
        .then(d => { setData(d); setLoading(false) })
        .catch(() => { setData({ total: 0, results: [], filters: { providers: [], categories: [] } }); setLoading(false) })
    }
  }, [isOpen, scanId, data])

  if (!scanId) return null

  let filtered = data?.results || []
  if (providerFilter !== 'all') filtered = filtered.filter((r: any) => r.provider === providerFilter)
  if (categoryFilter !== 'all') filtered = filtered.filter((r: any) => r.query_category === categoryFilter)
  if (mentionedOnly) filtered = filtered.filter((r: any) => r.brand_mentioned)

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition"
      >
        <div>
          <h3 className="text-sm font-bold text-gray-900">Query Details</h3>
          <p className="text-xs text-gray-400 mt-0.5">See every query sent to AI models and their responses</p>
        </div>
        <span className="text-gray-400 text-sm">{isOpen ? '▲ Hide' : '▼ Show'}</span>
      </button>

      {isOpen && (
        <div className="border-t border-gray-100">
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Loading queries...</div>
          ) : data?.total === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No query results available for this scan</div>
          ) : (
            <>
              {/* Filters */}
              <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
                {/* Provider filter */}
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

                {/* Category filter */}
                {data?.filters?.categories?.length > 0 && (
                  <select
                    value={categoryFilter}
                    onChange={e => setCategoryFilter(e.target.value)}
                    className="text-xs border border-gray-200 rounded-md px-2 py-1 text-gray-600"
                  >
                    <option value="all">All categories</option>
                    {data.filters.categories.map((cat: string) => (
                      <option key={cat} value={cat}>{cat.replace('_', ' ')}</option>
                    ))}
                  </select>
                )}

                {/* Mentioned only */}
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mentionedOnly}
                    onChange={e => setMentionedOnly(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  Mentioned only
                </label>

                {/* Count */}
                <span className="text-xs text-gray-400 ml-auto">
                  Showing {filtered.length} of {data?.total || 0}
                </span>
              </div>

              {/* Results list */}
              <div className="max-h-[600px] overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 text-sm">No matching queries</div>
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
