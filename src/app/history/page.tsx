"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import { SkeletonListItem } from "@/components/ui/skeleton"
import { useAuth } from "@/lib/auth"
import { createClient, isSupabaseConfigured } from "@/lib/supabase"
import { ArrowRight, ArrowUp, ArrowDown, Minus, Clock, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface ScanRecord {
  id: string
  status: string
  sources: any
  queries_tested: any
  signals: any
  actions: any
  competitor_results: any
  created_at: string
}

type VisibilityStatus = "recommended" | "low-visibility" | "not-mentioned"

function mapStatus(status: string): VisibilityStatus {
  if (status === "not_mentioned") return "not-mentioned"
  if (status === "low_visibility") return "low-visibility"
  if (status === "recommended") return "recommended"
  return "not-mentioned"
}

function getChangeIndicator(
  currentStatus: string,
  previousStatus: string | null,
  isFirst: boolean
): { label: string; color: string; icon: React.ReactNode } {
  if (isFirst) {
    return { label: "First scan", color: "text-muted-foreground", icon: <Clock className="size-3.5" /> }
  }

  if (!previousStatus) {
    return { label: "No change", color: "text-muted-foreground", icon: <Minus className="size-3.5" /> }
  }

  const statusRank: Record<string, number> = {
    not_mentioned: 0,
    "not-mentioned": 0,
    low_visibility: 1,
    "low-visibility": 1,
    recommended: 2,
  }

  const currentRank = statusRank[currentStatus] ?? 0
  const previousRank = statusRank[previousStatus] ?? 0

  if (currentRank > previousRank) {
    return { label: "Improved", color: "text-status-success", icon: <ArrowUp className="size-3.5" /> }
  } else if (currentRank < previousRank) {
    return { label: "Declined", color: "text-status-error", icon: <ArrowDown className="size-3.5" /> }
  } else {
    return { label: "No change", color: "text-muted-foreground", icon: <Minus className="size-3.5" /> }
  }
}

function getScanSummary(scan: ScanRecord): string {
  const chatgptMentioned = scan.sources?.chatgpt?.mentioned ?? false
  const claudeMentioned = scan.sources?.claude?.mentioned ?? false
  
  const mentionedCount = (chatgptMentioned ? 1 : 0) + (claudeMentioned ? 1 : 0)
  
  if (mentionedCount === 0) {
    return "Not mentioned by any source"
  } else if (mentionedCount === 1) {
    return "Mentioned by 1 of 2 sources"
  } else {
    const status = mapStatus(scan.status)
    if (status === "recommended") {
      return "Recommended by both sources"
    }
    return "Mentioned by both sources"
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export default function HistoryPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [scans, setScans] = useState<ScanRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadScans = async () => {
      if (!user || !isSupabaseConfigured()) {
        // Try loading from localStorage
        const stored = localStorage.getItem("mentioned_scan_result")
        if (stored) {
          try {
            const parsed = JSON.parse(stored)
            setScans([{
              id: "local",
              status: parsed.status,
              sources: parsed.sources,
              queries_tested: parsed.queries_tested,
              signals: parsed.signals,
              actions: parsed.actions,
              competitor_results: parsed.competitor_results,
              created_at: parsed.timestamp || new Date().toISOString(),
            }])
          } catch (e) {
            console.error("Error parsing local scan:", e)
          }
        }
        setIsLoading(false)
        return
      }

      try {
        const supabase = createClient()
        if (!supabase) {
          throw new Error("Database not configured")
        }
        
        // First get user's brand
        const { data: brands } = await supabase
          .from("brands")
          .select("id")
          .eq("user_id", user.id)
          .limit(1)

        if (!brands || brands.length === 0) {
          setIsLoading(false)
          return
        }

        const brandId = brands[0].id

        // Get all scans for this brand
        const { data: scanData, error: scanError } = await supabase
          .from("scans")
          .select("*")
          .eq("brand_id", brandId)
          .order("created_at", { ascending: false })

        if (scanError) {
          throw scanError
        }

        setScans(scanData || [])
      } catch (e) {
        console.error("Error loading scans:", e)
        setError("Failed to load scan history")
      } finally {
        setIsLoading(false)
      }
    }

    if (!authLoading) {
      loadScans()
    }
  }, [user, authLoading])

  return (
    <AppShell>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Scan History
          </h1>
          <p className="text-muted-foreground mt-1">
            Track how your AI visibility changes over time
          </p>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <SkeletonListItem key={i} />
            ))}
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="size-12 rounded-full bg-status-error-muted flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="size-6 text-status-error" />
              </div>
              <p className="text-foreground font-medium mb-2">Something went wrong</p>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button variant="secondary" onClick={() => window.location.reload()}>
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : scans.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Clock className="size-6 text-muted-foreground" />
              </div>
              <p className="text-foreground font-medium mb-2">No scans yet</p>
              <p className="text-muted-foreground mb-6">
                Run your first visibility check to see how AI tools perceive your product.
              </p>
              <Link href="/check">
                <Button>
                  Check your AI visibility
                  <ArrowRight className="ml-1 size-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {scans.map((scan, index) => {
              const previousScan = index < scans.length - 1 ? scans[index + 1] : null
              const isFirst = index === scans.length - 1
              const change = getChangeIndicator(scan.status, previousScan?.status ?? null, isFirst)

              return (
                <Link 
                  key={scan.id} 
                  href={scan.id === "local" ? "/dashboard" : `/history/${scan.id}`}
                >
                  <Card className="hover:border-foreground/20 transition-colors cursor-pointer">
                    <CardContent className="py-5">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                        {/* Mobile: Row with badge and change indicator */}
                        <div className="flex items-center gap-3 sm:contents">
                          {/* Status Badge */}
                          <StatusBadge status={mapStatus(scan.status)} className="shrink-0" />

                          {/* Change Indicator - Mobile */}
                          <div className={cn("flex items-center gap-1.5 text-sm sm:hidden", change.color)}>
                            {change.icon}
                            <span>{change.label}</span>
                          </div>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground">
                            {formatDate(scan.created_at)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {getScanSummary(scan)}
                          </p>
                        </div>

                        {/* Change Indicator - Desktop */}
                        <div className={cn("hidden sm:flex items-center gap-1.5 text-sm", change.color)}>
                          {change.icon}
                          <span>{change.label}</span>
                        </div>

                        {/* Arrow */}
                        <ArrowRight className="size-4 text-muted-foreground hidden sm:block" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}
