'use client';

import { useState } from 'react';

interface DataPoint {
  date: string;
  score: number;
}

const DEMO_DATA: DataPoint[] = [
  { date: 'Jan 01', score: 23 },
  { date: 'Jan 15', score: 31 },
  { date: 'Feb 01', score: 38 },
  { date: 'Feb 15', score: 42 },
  { date: 'Mar 01', score: 56 },
  { date: 'Mar 15', score: 67 },
  { date: 'Mar 31', score: 78 },
];

export function VisibilityGraph({ data = DEMO_DATA, showDemo = true }: { data?: DataPoint[]; showDemo?: boolean }) {
  const [activePoint, setActivePoint] = useState<number | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('90d');
  
  const maxScore = Math.max(...data.map(d => d.score));
  const minScore = Math.min(...data.map(d => d.score));
  const startScore = data[0]?.score || 0;
  const endScore = data[data.length - 1]?.score || 0;
  const change = endScore - startScore;
  const changePercent = startScore > 0 ? Math.round((change / startScore) * 100) : 0;
  
  const generatePath = () => {
    const width = 100, height = 100, padding = 10;
    const points = data.map((d, i) => ({
      x: padding + (i / (data.length - 1)) * (width - padding * 2),
      y: height - padding - ((d.score - minScore) / (maxScore - minScore || 1)) * (height - padding * 2),
    }));
    const pathD = points.reduce((acc, point, i) => {
      if (i === 0) return `M ${point.x} ${point.y}`;
      const prev = points[i - 1];
      return `${acc} C ${prev.x + (point.x - prev.x) / 3} ${prev.y}, ${prev.x + (point.x - prev.x) * 2 / 3} ${point.y}, ${point.x} ${point.y}`;
    }, '');
    const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${padding} ${height - padding} Z`;
    return { linePath: pathD, areaPath: areaD, points };
  };
  
  const { linePath, areaPath, points } = generatePath();
  
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-lg overflow-hidden">
      <div className="p-4 sm:p-6 pb-2 sm:pb-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Visibility Score</h3>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl sm:text-4xl font-bold text-gray-900">{endScore}</span>
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-medium ${change >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={change >= 0 ? "M5 10l7-7m0 0l7 7m-7-7v18" : "M19 14l-7 7m0 0l-7-7m7 7V3"} />
                </svg>
                {changePercent > 0 ? '+' : ''}{changePercent}%
              </div>
            </div>
            {showDemo && <p className="text-xs text-gray-400 mt-1">Demo data — Track your real progress</p>}
          </div>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button key={range} onClick={() => setTimeRange(range)} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${timeRange === range ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {range === '7d' ? '7D' : range === '30d' ? '30D' : '90D'}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="relative h-48 sm:h-56 px-4 sm:px-6 pb-4 sm:pb-6">
        <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#F56565" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#F56565" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#E53E3E" />
              <stop offset="100%" stopColor="#F56565" />
            </linearGradient>
          </defs>
          {[25, 50, 75].map((y) => <line key={y} x1="10" y1={y} x2="90" y2={y} stroke="#E5E7EB" strokeWidth="0.3" strokeDasharray="2,2" />)}
          <path d={areaPath} fill="url(#areaGradient)" />
          <path d={linePath} fill="none" stroke="url(#lineGradient)" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {points.map((point, i) => (
            <circle key={i} cx={point.x} cy={point.y} r={activePoint === i ? 4 : 2.5} fill="#E53E3E" stroke="white" strokeWidth="1.5" className="cursor-pointer transition-all" onMouseEnter={() => setActivePoint(i)} onMouseLeave={() => setActivePoint(null)} />
          ))}
        </svg>
        {activePoint !== null && (
          <div className="absolute bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-full" style={{ left: `${10 + (activePoint / (data.length - 1)) * 80}%`, top: `${100 - 10 - ((data[activePoint].score - minScore) / (maxScore - minScore || 1)) * 80}%` }}>
            <div className="font-medium">{data[activePoint].score}/100</div>
            <div className="text-gray-400">{data[activePoint].date}</div>
          </div>
        )}
        <div className="absolute bottom-0 left-4 right-4 sm:left-6 sm:right-6 flex justify-between text-[10px] text-gray-400">
          <span>{data[0]?.date}</span>
          <span>{data[data.length - 1]?.date}</span>
        </div>
      </div>
    </div>
  );
}
