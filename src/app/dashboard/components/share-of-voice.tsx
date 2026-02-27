'use client'

interface ShareOfVoiceProps {
  data: any | null
}

export function ShareOfVoice({ data }: ShareOfVoiceProps) {
  if (!data || !data.brands || data.brands.length === 0) {
    return (
      <div className="bg-gray-50 rounded-xl p-6 text-center text-gray-400 text-sm">
        Run a scan to see share of voice
      </div>
    )
  }

  return (
    <div className="bg-background border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">Share of Voice</h3>
        {data.your_rank > 0 && (
          <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">
            Ranked #{data.your_rank}
          </span>
        )}
      </div>

      {/* Stacked Bar */}
      <div className="flex h-10 rounded-lg overflow-hidden mb-4">
        {data.brands.slice(0, 6).map((brand: any, i: number) => (
          <div
            key={brand.name}
            style={{ width: `${Math.max(brand.share_pct, 3)}%` }}
            className={`flex items-center justify-center text-xs font-medium truncate px-1 ${
              brand.is_self
                ? 'bg-blue-600 text-white'
                : i % 2 === 0
                  ? 'bg-gray-300 text-gray-700'
                  : 'bg-gray-200 text-gray-600'
            }`}
            title={`${brand.name}: ${brand.share_pct}%`}
          >
            {brand.share_pct >= 8 ? `${brand.name} ${brand.share_pct}%` : ''}
          </div>
        ))}
      </div>

      {/* Ranked Table */}
      <div className="space-y-1">
        {data.brands.slice(0, 5).map((brand: any, i: number) => (
          <div
            key={brand.name}
            className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
              brand.is_self ? 'bg-blue-50 border-l-2 border-blue-600 font-semibold' : ''
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-gray-400 text-xs w-5">#{i + 1}</span>
              <span className="text-gray-900">{brand.name}</span>
              {brand.is_self && <span className="text-xs text-blue-600">(you)</span>}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-gray-500 text-xs">{brand.total_mentions} mentions</span>
              <span className="font-semibold text-gray-900">{brand.share_pct}%</span>
            </div>
          </div>
        ))}
      </div>

      {data.brands.length > 5 && (
        <p className="text-xs text-gray-400 mt-2 text-center">
          +{data.brands.length - 5} more brands
        </p>
      )}
    </div>
  )
}
