"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { SkeletonCard } from "@/components/ui/skeleton"
import { VisibilityProgress, type ScanHistoryEntry } from "@/components/VisibilityProgress"
import { useSubscription } from "@/lib/subscription"
import { UpgradePrompt } from "@/components/upgrade-prompt"
import { 
  ArrowLeft, 
  TrendingUp, 
  BarChart3, 
  Calendar,
  Target,
  Zap,
  RefreshCw
} from "lucide-react"

export default function ProgressPage() {
  const router = useRouter()
  const subscription = useSubscription()
  const [history, setHistory] = useState<ScanHistoryEntry[]>([])
  const [productName, setProductName] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  // Show upgrade modal for free users
  useEffect(() => {
    if (!subscription.isLoading && subscription.plan === "free") {
      setShowUpgradeModal(true)
    }
  }, [subscription.isLoading, subscription.plan])

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        // Get product info from localStorage
        const storedData = localStorage.getItem("mentioned_scan_result")
        let productUrl: string | undefined
        let name = "Your Product"
        
        if (storedData) {
          const parsed = JSON.parse(storedData)
          productUrl = parsed.productData?.url || parsed.brand?.url
          name = parsed.brandName || parsed.brand?.name || parsed.productData?.product_name || "Your Product"
        }
        
        setProductName(name)
        
        const params = new URLSearchParams()
        if (productUrl) {
          params.set('productUrl', productUrl)
        }
        params.set('limit', '50')
        
        const response = await fetch(`/api/scan-history?${params.toString()}`)
        if (response.ok) {
          const data = await response.json()
          setHistory(data.history || [])
        }
      } catch (error) {
        console.error("Error fetching scan history:", error)
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchHistory()
  }, [])

  const handleDelete = (scanId: string) => {
    setHistory(prev => prev.filter(h => h.id !== scanId))
  }

  // Calculate additional stats
  const getStats = () => {
    if (history.length === 0) return null
    
    const latest = history[history.length - 1]
    const first = history[0]
    const scoreChange = latest.score - first.score
    const mentionChange = latest.mentionRate - first.mentionRate
    
    // Calculate average score
    const avgScore = Math.round(history.reduce((sum, h) => sum + h.score, 0) / history.length)
    
    // Find best week
    const bestScore = Math.max(...history.map(h => h.score))
    const bestScan = history.find(h => h.score === bestScore)
    
    // Calculate consistency (how stable are scores)
    const scores = history.map(h => h.score)
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length
    const consistency = Math.max(0, 100 - Math.sqrt(variance))
    
    return {
      latest,
      first,
      scoreChange,
      mentionChange,
      avgScore,
      bestScore,
      bestScan,
      consistency: Math.round(consistency),
      totalScans: history.length,
    }
  }

  const stats = getStats()

  return (
    <AppShell>
      <div className="space-y-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="shrink-0">
                <ArrowLeft className="size-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Visibility Progress
              </h1>
              <p className="text-gray-500 mt-1">
                Track how your AI visibility changes over time
              </p>
            </div>
          </div>
          <Link href="/check">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-5 rounded-lg shadow-sm">
              <RefreshCw className="size-4 mr-2" />
              New Scan
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            <SkeletonCard className="h-80" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <SkeletonCard key={i} className="h-24" />
              ))}
            </div>
          </div>
        ) : history.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
            <div className="py-16 text-center px-6">
              <div className="size-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
                <BarChart3 className="size-8 text-gray-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                No progress data yet
              </h2>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                Run your first visibility check to start tracking your progress over time. Each scan will be saved here.
              </p>
              <Link href="/check">
                <Button size="lg">
                  Run your first scan
                  <TrendingUp className="ml-2 size-4" />
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Main Progress Chart */}
            <VisibilityProgress 
              history={history} 
              productName={productName}
              onDelete={handleDelete}
            />

            {/* Stats Grid */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Total Scans */}
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Calendar className="size-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{stats.totalScans}</p>
                      <p className="text-xs text-gray-500 mt-1">Total Scans</p>
                    </div>
                  </div>
                </div>

                {/* Average Score */}
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                      <Target className="size-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{stats.avgScore}</p>
                      <p className="text-xs text-gray-500 mt-1">Avg Score</p>
                    </div>
                  </div>
                </div>

                {/* Best Score */}
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <TrendingUp className="size-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{stats.bestScore}</p>
                      <p className="text-xs text-gray-500 mt-1">Best Score</p>
                    </div>
                  </div>
                </div>

                {/* Improvement */}
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      stats.scoreChange >= 0 ? 'bg-emerald-100' : 'bg-red-100'
                    }`}>
                      <Zap className={`size-5 ${
                        stats.scoreChange >= 0 ? 'text-green-500' : 'text-red-500'
                      }`} />
                    </div>
                    <div>
                      <p className={`text-2xl font-bold ${
                        stats.scoreChange >= 0 ? 'text-emerald-600' : 'text-red-500'
                      }`}>
                        {stats.scoreChange > 0 ? '+' : ''}{stats.scoreChange}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Total Change</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tips Section */}
            {stats && stats.latest.score < 70 && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="size-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <TrendingUp className="size-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-blue-900 mb-2">Tips to improve your score</h3>
                    <ul className="text-sm text-gray-700 leading-relaxed space-y-2">
                      <li>• Create comparison pages vs. top competitors</li>
                      <li>• Add an FAQ section answering common questions</li>
                      <li>• Make sure your homepage clearly states your category</li>
                      <li>• Add customer testimonials and case studies</li>
                    </ul>
                    <Link href="/dashboard" className="inline-block mt-3">
                      <Button variant="outline" size="sm" className="bg-white">
                        View action plan
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Celebration for high scores */}
            {stats && stats.latest.score >= 80 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="text-3xl">🎉</div>
                  <div>
                    <h3 className="font-semibold text-emerald-900 mb-2">Excellent visibility!</h3>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      Your product is being recommended by AI tools. Keep up the great work! 
                      Continue monitoring your progress to maintain your position.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Upgrade Modal for Free Users */}
      {showUpgradeModal && (
        <UpgradePrompt
          feature="history"
          onClose={() => {
            setShowUpgradeModal(false)
            router.push("/dashboard")
          }}
        />
      )}
    </AppShell>
  )
}
