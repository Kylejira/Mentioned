'use client';

interface ScoreDeltaProps {
  delta: number | null;
  suffix?: string;
  size?: 'sm' | 'md';
}

export function ScoreDelta({ delta, suffix = '', size = 'sm' }: ScoreDeltaProps) {
  if (delta == null) return <span className="text-gray-400 text-xs">First scan</span>;
  if (delta === 0) return <span className="text-gray-500 text-xs">— No change</span>;

  const isPositive = delta > 0;
  const color = isPositive ? 'text-green-600' : 'text-red-500';
  const arrow = isPositive ? '▲' : '▼';
  const sizeClass = size === 'md' ? 'text-sm font-semibold' : 'text-xs font-medium';

  return (
    <span className={`${color} ${sizeClass} inline-flex items-center gap-0.5`}>
      {arrow} {isPositive ? '+' : ''}{Math.round(delta * 100) / 100}{suffix}
    </span>
  );
}
