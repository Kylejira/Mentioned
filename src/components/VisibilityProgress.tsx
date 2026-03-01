'use client';

import { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, BarChart3, Trash2, AlertCircle, ChevronDown } from 'lucide-react';

export interface ScanHistoryEntry {
  id: string;
  score: number;
  mentionRate: number;
  top3Rate: number;
  avgPosition: number | null;
  chatgptScore: number | null;
  claudeScore: number | null;
  scannedAt: string;
}

interface VisibilityProgressProps {
  history: ScanHistoryEntry[];
  productName: string;
  onDelete?: (scanId: string) => void;
}

export function VisibilityProgress({ history: initialHistory, productName, onDelete }: VisibilityProgressProps) {
  const [history, setHistory] = useState(initialHistory);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  
  // Calculate stats
  const stats = useMemo(() => {
    if (history.length === 0) return null;
    
    const latest = history[history.length - 1];
    const first = history[0];
    const scoreChange = latest.score - first.score;
    
    const scores = history.map(h => h.score);
    const highestScore = Math.max(...scores);
    const lowestScore = Math.min(...scores);
    
    return {
      latest,
      first,
      scoreChange,
      highestScore,
      lowestScore,
      totalScans: history.length,
    };
  }, [history]);
  
  const handleDelete = async (scanId: string) => {
    setDeletingId(scanId);
    
    try {
      const response = await fetch(`/api/scan-history/${scanId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        // Remove from local state
        setHistory(prev => prev.filter(h => h.id !== scanId));
        setConfirmDeleteId(null);
        
        // Call parent callback if provided
        if (onDelete) {
          onDelete(scanId);
        }
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete scan');
      }
    } catch (error) {
      console.error('Error deleting scan:', error);
      alert('Failed to delete scan');
    } finally {
      setDeletingId(null);
    }
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  
  const formatFullDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };
  
  if (!stats || history.length < 2) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="text-center py-8">
          <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-gray-900 font-semibold mb-1">Track your progress</h3>
          <p className="text-gray-500 text-sm max-w-xs mx-auto">
            Run at least 2 scans to see your visibility trend over time.
          </p>
        </div>
        
        {/* Show single scan with delete option */}
        {history.length === 1 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg group">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Score: {history[0].score}/100
                </p>
                <p className="text-xs text-gray-500">
                  {formatFullDate(history[0].scannedAt)}
                </p>
              </div>
              <button
                onClick={() => setConfirmDeleteId(history[0].id)}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete this scan"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            
            {/* Delete confirmation */}
            {confirmDeleteId === history[0].id && (
              <DeleteConfirmation
                onConfirm={() => handleDelete(history[0].id)}
                onCancel={() => setConfirmDeleteId(null)}
                isDeleting={deletingId === history[0].id}
              />
            )}
          </div>
        )}
      </div>
    );
  }
  
  // Generate SVG path for the graph
  const generatePath = () => {
    const width = 100;
    const height = 50;
    const padding = 5;
    
    const minScore = Math.min(...history.map(h => h.score)) - 5;
    const maxScore = Math.max(...history.map(h => h.score)) + 5;
    const scoreRange = maxScore - minScore || 1;
    
    const points = history.map((entry, i) => {
      const x = padding + (i / (history.length - 1)) * (width - padding * 2);
      const y = height - padding - ((entry.score - minScore) / scoreRange) * (height - padding * 2);
      return { x, y, entry };
    });
    
    const pathD = points.reduce((acc, point, i) => {
      if (i === 0) return `M ${point.x} ${point.y}`;
      const prev = points[i - 1];
      const cpx1 = prev.x + (point.x - prev.x) / 3;
      const cpx2 = prev.x + (point.x - prev.x) * 2 / 3;
      return `${acc} C ${cpx1} ${prev.y}, ${cpx2} ${point.y}, ${point.x} ${point.y}`;
    }, '');
    
    const lastPoint = points[points.length - 1];
    const firstPoint = points[0];
    const areaD = `${pathD} L ${lastPoint.x} ${height - padding} L ${firstPoint.x} ${height - padding} Z`;
    
    return { linePath: pathD, areaPath: areaD, points };
  };
  
  const { linePath, areaPath, points } = generatePath();
  const isPositive = stats.scoreChange >= 0;
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 pb-0">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-gray-900 font-semibold text-lg">Visibility Progress</h3>
            <p className="text-gray-500 text-sm">{productName}</p>
          </div>
          
          {/* Change indicator */}
          <div className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-lg
            ${isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}
          `}>
            {stats.scoreChange === 0 ? (
              <Minus className="w-5 h-5" />
            ) : isPositive ? (
              <TrendingUp className="w-5 h-5" />
            ) : (
              <TrendingDown className="w-5 h-5" />
            )}
            <span className="text-sm font-bold">
              {stats.scoreChange > 0 ? '+' : ''}{stats.scoreChange} pts
            </span>
          </div>
        </div>
        
        {/* Current score */}
        <div className="flex items-baseline gap-2 mb-1">
          <span className={`text-4xl font-extrabold ${
            stats.latest.score >= 70 ? 'text-emerald-500' : 
            stats.latest.score >= 40 ? 'text-amber-500' : 'text-red-500'
          }`}>
            {stats.latest.score}
          </span>
          <span className="text-gray-400 text-xl">/100</span>
          <span className="text-gray-500 text-sm ml-2">current score</span>
        </div>
      </div>
      
      {/* Graph */}
      <div className="px-6 py-4 relative">
        <svg
          viewBox="0 0 100 50"
          className="w-full h-32 sm:h-40"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={isPositive ? '#10B981' : '#EF4444'} stopOpacity="0.2" />
              <stop offset="100%" stopColor={isPositive ? '#10B981' : '#EF4444'} stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="progressLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={isPositive ? '#059669' : '#DC2626'} />
              <stop offset="100%" stopColor={isPositive ? '#10B981' : '#EF4444'} />
            </linearGradient>
          </defs>
          
          {/* Horizontal gridlines at 25, 50, 75, 100 score marks */}
          {[11.25, 22.5, 33.75, 45].map((y) => (
            <line key={y} x1="5" y1={y} x2="95" y2={y} stroke="#F3F4F6" strokeWidth="0.4" />
          ))}
          
          <path d={areaPath} fill="url(#progressGradient)" />
          <path d={linePath} fill="none" stroke="url(#progressLineGradient)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          
          {/* Data points */}
          {points.map((point, i) => (
            <circle
              key={i}
              cx={point.x}
              cy={point.y}
              r={hoveredPoint === i ? 3.5 : 2}
              fill={isPositive ? '#10B981' : '#EF4444'}
              stroke="white"
              strokeWidth="1.2"
              className="cursor-pointer transition-all duration-150"
              onMouseEnter={() => setHoveredPoint(i)}
              onMouseLeave={() => setHoveredPoint(null)}
            />
          ))}
        </svg>
        
        {/* Tooltip */}
        {hoveredPoint !== null && (
          <div
            className="absolute bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg pointer-events-none z-10"
            style={{
              left: `${5 + (hoveredPoint / (history.length - 1)) * 90}%`,
              top: '20%',
              transform: 'translateX(-50%)',
            }}
          >
            <div className="font-semibold">{history[hoveredPoint].score}/100</div>
            <div className="text-gray-400">{formatDate(history[hoveredPoint].scannedAt)}</div>
            <div className="text-gray-400">{history[hoveredPoint].mentionRate}% mentioned</div>
          </div>
        )}
        
        {/* X-axis labels */}
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>{formatDate(history[0].scannedAt)}</span>
          <span>{formatDate(history[history.length - 1].scannedAt)}</span>
        </div>
      </div>
      
      {/* Stats row */}
      <div className="flex divide-x divide-gray-200 p-6 pt-2 border-t border-gray-100 bg-gray-50/50">
        <div className="flex-1 text-center">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">Scans</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalScans}</p>
        </div>
        <div className="flex-1 text-center">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">Highest</p>
          <p className="text-2xl font-bold text-green-600">{stats.highestScore}</p>
        </div>
        <div className="flex-1 text-center">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">Lowest</p>
          <p className={`text-2xl font-bold ${stats.lowestScore === 0 ? 'text-red-500' : 'text-gray-900'}`}>{stats.lowestScore}</p>
        </div>
      </div>
      
      {/* Scan history toggle */}
      <div className="border-t border-gray-100">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full px-6 py-3 flex items-center justify-between text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <span>Scan history ({history.length})</span>
          <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
        </button>
        
        {/* Expandable history list */}
        {showHistory && (
          <div className="px-6 pb-4 space-y-2 max-h-64 overflow-y-auto">
            {[...history].reverse().map((entry) => (
              <div 
                key={entry.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg group hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`
                    w-10 h-10 rounded-lg flex items-center justify-center font-semibold text-sm
                    ${entry.score >= 70 ? 'bg-emerald-100 text-emerald-700' : 
                      entry.score >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}
                  `}>
                    {entry.score}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {entry.mentionRate}% mention rate
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFullDate(entry.scannedAt)}
                    </p>
                  </div>
                </div>
                
                {/* Delete button */}
                <button
                  onClick={() => setConfirmDeleteId(entry.id)}
                  disabled={deletingId === entry.id}
                  className={`
                    p-2 rounded-lg transition-all
                    ${deletingId === entry.id 
                      ? 'text-gray-300 cursor-not-allowed' 
                      : 'text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100'
                    }
                  `}
                  title="Delete this scan"
                >
                  {deletingId === entry.id ? (
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Delete confirmation modal */}
      {confirmDeleteId && (
        <DeleteConfirmation
          onConfirm={() => handleDelete(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
          isDeleting={deletingId === confirmDeleteId}
        />
      )}
    </div>
  );
}

// Delete confirmation component
function DeleteConfirmation({ 
  onConfirm, 
  onCancel, 
  isDeleting 
}: { 
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Delete scan?</h3>
            <p className="text-sm text-gray-500">This action cannot be undone.</p>
          </div>
        </div>
        
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to delete this scan from your history? This is useful if you ran a scan with incorrect information.
        </p>
        
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
