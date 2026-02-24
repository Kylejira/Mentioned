"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import { StatusIcon } from "@/components/ui/status-icon"
import { SlideOver } from "@/components/ui/slide-over"
import { SkeletonCard } from "@/components/ui/skeleton"
import { useAuth } from "@/lib/auth"
import { createClient, isSupabaseConfigured } from "@/lib/supabase"
import { 
  ArrowLeft, 
  ArrowRight,
  ChevronDown, 
  ChevronRight, 
  Check, 
  X, 
  AlertTriangle,
  Sparkles,
  Copy,
  CheckCircle2,
  Loader2,
  AlertCircle
} from "lucide-react"
import { cn } from "@/lib/utils"
import { type Action, type ScanData, type VisibilityStatus } from "@/lib/mock-data"

interface PageProps {
  params: Promise<{ scanId: string }>
}

function mapStatus(status: string): VisibilityStatus {
  if (status === "not_mentioned") return "not-mentioned"
  if (status === "low_visibility") return "low-visibility"
  if (status === "recommended") return "recommended"
  return "not-mentioned"
}

function mapPosition(position: string): "top-3" | "mentioned" | "not-found" {
  if (position === "top_3") return "top-3"
  if (position === "mentioned") return "mentioned"
  return "not-found"
}

function getStatusMessage(status: string): string {
  if (status === "not_mentioned" || status === "not-mentioned") 
    return "AI tools don't mention your product"
  if (status === "low_visibility" || status === "low-visibility") 
    return "Mentioned, but not recommended"
  if (status === "recommended") 
    return "AI tools actively recommend your product"
  return "Unknown status"
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

export default function HistoricalScanPage({ params }: PageProps) {
  const router = useRouter()
  const { scanId } = use(params)
  const { user, loading: authLoading } = useAuth()
  
  const [scanData, setScanData] = useState<any>(null)
  const [brandData, setBrandData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [queriesExpanded, setQueriesExpanded] = useState(false)
  const [selectedAction, setSelectedAction] = useState<any>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedContent, setGeneratedContent] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const loadScan = async () => {
      if (!user || !isSupabaseConfigured()) {
        setError("Please log in to view scan history")
        setIsLoading(false)
        return
      }

      try {
        const supabase = createClient()
        if (!supabase) {
          throw new Error("Database not configured")
        }
        
        // Get the scan
        const { data: scan, error: scanError } = await supabase
          .from("scans")
          .select("*, brands(*)")
          .eq("id", scanId)
          .single()

        if (scanError || !scan) {
          throw new Error("Scan not found")
        }

        setScanData(scan)
        setBrandData(scan.brands)
      } catch (e) {
        console.error("Error loading scan:", e)
        setError(e instanceof Error ? e.message : "Failed to load scan")
      } finally {
        setIsLoading(false)
      }
    }

    if (!authLoading) {
      loadScan()
    }
  }, [scanId, user, authLoading])

  const handleGenerateDraft = (action: any) => {
    setSelectedAction(action)
    setIsGenerating(true)
    setGeneratedContent(null)
    
    setTimeout(() => {
      setIsGenerating(false)
      setGeneratedContent(action.draftContent || `# ${action.title}\n\n${action.what}`)
    }, 1500)
  }

  const handleCopy = async () => {
    if (generatedContent) {
      await navigator.clipboard.writeText(generatedContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleCloseSlideOver = () => {
    setSelectedAction(null)
    setIsGenerating(false)
    setGeneratedContent(null)
  }

  const getSourceIcon = (source: "chatgpt" | "claude") => {
    if (source === "chatgpt") {
      return (
        <div className="size-10 rounded-xl bg-[#10a37f]/10 flex items-center justify-center">
          <span className="text-lg font-bold text-[#10a37f]">G</span>
        </div>
      )
    }
    return (
      <div className="size-10 rounded-xl bg-[#cc785c]/10 flex items-center justify-center">
        <span className="text-lg font-bold text-[#cc785c]">C</span>
      </div>
    )
  }

  if (isLoading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <SkeletonCard className="h-48" />
          <SkeletonCard className="h-32" />
          <SkeletonCard className="h-32" />
        </div>
      </AppShell>
    )
  }

  if (error || !scanData) {
    return (
      <AppShell>
        <Card>
          <CardContent className="py-12 text-center">
            <div className="size-12 rounded-full bg-status-error-muted flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="size-6 text-status-error" />
            </div>
            <p className="text-foreground font-medium mb-2">
              {error || "Scan not found"}
            </p>
            <Link href="/history">
              <Button variant="secondary">
                <ArrowLeft className="size-4 mr-1" />
                Back to history
              </Button>
            </Link>
          </CardContent>
        </Card>
      </AppShell>
    )
  }

  const status = mapStatus(scanData.status)
  const sources = [
    {
      source: "chatgpt" as const,
      mentioned: scanData.sources?.chatgpt?.mentioned ?? false,
      position: mapPosition(scanData.sources?.chatgpt?.position || "not_found"),
      description: scanData.sources?.chatgpt?.description ?? null,
      descriptionAccurate: scanData.sources?.chatgpt?.descriptionAccurate ?? false,
    },
    {
      source: "claude" as const,
      mentioned: scanData.sources?.claude?.mentioned ?? false,
      position: mapPosition(scanData.sources?.claude?.position || "not_found"),
      description: scanData.sources?.claude?.description ?? null,
      descriptionAccurate: scanData.sources?.claude?.descriptionAccurate ?? false,
    },
  ]
  const rawQueries = scanData.queries_tested || []
  const queries = Array.isArray(rawQueries) ? rawQueries : []
  const competitors = scanData.competitor_results || []
  const signals = scanData.signals || []
  const actions = scanData.actions || []

  return (
    <AppShell>
      <div className="space-y-8">
        {/* Historical Banner */}
        <div className="bg-muted/50 border border-border rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link 
              href="/history"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <span className="text-sm text-muted-foreground">
              Viewing scan from <span className="text-foreground font-medium">{formatDate(scanData.created_at)}</span>
            </span>
          </div>
          <Link href="/dashboard">
            <Button variant="secondary" size="sm">
              View latest scan
              <ArrowRight className="size-4 ml-1" />
            </Button>
          </Link>
        </div>

        {/* Visibility Status */}
        <section>
          <Card className="overflow-hidden">
            <CardContent className="p-8">
              <div className="flex flex-col items-center text-center mb-8">
                <StatusBadge status={status} className="text-base px-5 py-2" />
                <p className="mt-3 text-muted-foreground">
                  {getStatusMessage(scanData.status)}
                </p>
              </div>

              <p className="text-center text-sm text-muted-foreground mb-6">
                When users ask for <span className="font-medium text-foreground">{brandData?.category || "your category"}</span> tools, here&apos;s how AI responded:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sources.map((source) => (
                  <div
                    key={source.source}
                    className="rounded-xl border border-border bg-background p-5"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      {getSourceIcon(source.source)}
                      <div>
                        <p className="font-medium text-foreground capitalize">
                          {source.source === "chatgpt" ? "ChatGPT" : "Claude"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {source.position === "top-3" && "Top 3 recommendation"}
                          {source.position === "mentioned" && "Mentioned"}
                          {source.position === "not-found" && "Not in recommendations"}
                        </p>
                      </div>
                      <div className="ml-auto">
                        {source.mentioned ? (
                          <div className="size-6 rounded-full bg-status-success-muted flex items-center justify-center">
                            <Check className="size-3.5 text-status-success" />
                          </div>
                        ) : (
                          <div className="size-6 rounded-full bg-status-error-muted flex items-center justify-center">
                            <X className="size-3.5 text-status-error" />
                          </div>
                        )}
                      </div>
                    </div>

                    {source.description && (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground italic">
                          &quot;{source.description}&quot;
                        </p>
                        {!source.descriptionAccurate && (
                          <p className="text-xs text-status-warning flex items-center gap-1">
                            <AlertTriangle className="size-3" />
                            This may not match your actual positioning
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Queries Tested */}
        {queries.length > 0 && (
          <section>
            <button
              onClick={() => setQueriesExpanded(!queriesExpanded)}
              className="w-full flex items-center justify-between py-3 text-left group"
            >
              <h2 className="text-lg font-semibold text-foreground">
                Queries tested
              </h2>
              <div className="size-8 rounded-full bg-muted flex items-center justify-center transition-colors group-hover:bg-muted/80">
                {queriesExpanded ? (
                  <ChevronDown className="size-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="size-4 text-muted-foreground" />
                )}
              </div>
            </button>

            {queriesExpanded && (
              <Card className="animate-fade-in">
                <CardContent className="py-4">
                  <ul className="divide-y divide-border">
                    {queries.map((query: any, index: number) => (
                      <li
                        key={index}
                        className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                      >
                        <span className="text-sm text-foreground">
                          &quot;{query.query}&quot;
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            {query.chatgpt ? (
                              <Check className="size-3.5 text-status-success" />
                            ) : (
                              <X className="size-3.5 text-status-error" />
                            )}
                            ChatGPT
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            {query.claude ? (
                              <Check className="size-3.5 text-status-success" />
                            ) : (
                              <X className="size-3.5 text-status-error" />
                            )}
                            Claude
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </section>
        )}

        {/* Competitors */}
        {competitors.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Competitor visibility
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {competitors.map((competitor: any) => (
                <Card key={competitor.name}>
                  <CardContent className="py-5">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-medium text-foreground">
                        {competitor.name}
                      </h3>
                      <StatusIcon
                        status={
                          competitor.visibilityLevel === "recommended"
                            ? "success"
                            : competitor.visibilityLevel === "low_visibility" || competitor.visibilityLevel === "low-visibility"
                            ? "warning"
                            : "error"
                        }
                      />
                    </div>
                    <p className="text-xs text-muted-foreground capitalize">
                      {competitor.visibilityLevel === "recommended" && "Recommended"}
                      {(competitor.visibilityLevel === "low_visibility" || competitor.visibilityLevel === "low-visibility") && "Mentioned"}
                      {(competitor.visibilityLevel === "not_mentioned" || competitor.visibilityLevel === "not-mentioned") && "Not found"}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Signals */}
        {signals.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Visibility signals
            </h2>
            <div className="space-y-3">
              {signals.map((signal: any) => (
                <Card key={signal.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                      <StatusIcon status={signal.status} withBackground />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-foreground text-sm">
                            {signal.name}
                          </h3>
                          <span className="text-xs text-muted-foreground/70 capitalize">
                            {signal.confidence}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {signal.explanation}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Actions */}
        {actions.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="size-5 text-foreground" />
              <h2 className="text-lg font-semibold text-foreground">
                Action plan
              </h2>
            </div>
            <div className="space-y-4">
              {actions.map((action: any, idx: number) => (
                <Card key={action.id || idx} className="overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="size-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold shrink-0">
                        #{action.priority || idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground mb-2">
                          {action.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-3">
                          {action.why}
                        </p>
                        <p className="text-sm text-foreground/80 mb-4">
                          {action.what}
                        </p>
                        <Button
                          size="sm"
                          onClick={() => handleGenerateDraft(action)}
                        >
                          <Sparkles className="size-3.5 mr-1.5" />
                          Generate draft
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Slide-over Panel */}
      <SlideOver
        open={selectedAction !== null}
        onClose={handleCloseSlideOver}
        title={selectedAction?.title || ""}
      >
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="size-8 text-muted-foreground animate-spin mb-4" />
            <p className="text-muted-foreground">Generating your draft...</p>
          </div>
        ) : generatedContent ? (
          <div className="space-y-6">
            <div className="flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopy}
                className="gap-1.5"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="size-3.5" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" />
                    Copy to clipboard
                  </>
                )}
              </Button>
            </div>
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap text-sm text-foreground bg-muted rounded-xl p-4 overflow-x-auto font-sans leading-relaxed">
                {generatedContent}
              </pre>
            </div>
          </div>
        ) : null}
      </SlideOver>
    </AppShell>
  )
}
