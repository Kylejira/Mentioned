'use client';

import { useState } from 'react';

interface PlatformData {
  name: string;
  count: number;
  change: number;
}

const DEMO_DATA: PlatformData[] = [
  { name: 'ChatGPT', count: 18, change: 4 },
  { name: 'Claude', count: 16, change: 3 },
  { name: 'Perplexity', count: 12, change: 2 },
  { name: 'Gemini', count: 8, change: -1 },
  { name: 'Grok', count: 6, change: 1 },
];

export function PlatformBreakdown({ data = DEMO_DATA, showDemo = true }: { data?: PlatformData[]; showDemo?: boolean }) {
  const [timeRange, setTimeRange] = useState<'month' | 'week'>('month');
  
  return (
    <div className="bg-[#1A1A1A] rounded-2xl overflow-hidden relative">
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)`, backgroundSize: '30px 30px' }} />
      <div className="relative p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h3 className="text-white font-semibold text-sm sm:text-base">Mentions by Platform</h3>
          {showDemo && <span className="text-[10px] text-gray-500 bg-gray-800 px-2 py-0.5 rounded">Demo</span>}
        </div>
        <div className="grid grid-cols-3 gap-4 text-xs font-medium text-red-400 mb-3 px-1">
          <span>Platform</span>
          <span className="text-center">Mentions</span>
          <span className="text-right">Change</span>
        </div>
        <div className="space-y-2">
          {data.map((platform) => (
            <div key={platform.name} className="grid grid-cols-3 gap-4 items-center py-2.5 px-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
              <span className="text-white text-sm font-medium">{platform.name}</span>
              <span className="text-white text-sm text-center font-mono">{platform.count}</span>
              <div className="flex justify-end">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${platform.change >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={platform.change >= 0 ? "M5 10l7-7m0 0l7 7m-7-7v18" : "M19 14l-7 7m0 0l-7-7m7 7V3"} />
                  </svg>
                  {Math.abs(platform.change)}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-2 mt-4 sm:mt-6 pt-4 border-t border-white/10">
          <button onClick={() => setTimeRange('month')} className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${timeRange === 'month' ? 'bg-white/10 text-white border border-white/20' : 'text-gray-400 hover:text-white border border-transparent'}`}>Last Month</button>
          <button onClick={() => setTimeRange('week')} className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${timeRange === 'week' ? 'bg-red-500 text-white border border-red-500' : 'text-gray-400 hover:text-white border border-white/20'}`}>Last 7 Days</button>
        </div>
      </div>
    </div>
  );
}
