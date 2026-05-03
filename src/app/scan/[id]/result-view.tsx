"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Linkedin,
  Loader2,
  Twitter,
  TrendingUp,
  AlertCircle,
  Lock,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export interface PublicScanData {
  id: string
  status: string
  stage: string | null
  progress: number
  score: number | null
  saasProfile: Record<string, unknown> | null
  summary: Record<string, unknown> | null
  queryCount: number | null
  createdAt: string | null
}

interface StatusResponse {
  scanId: string
  status: string
  stage: string | null
  progress: number
  score: number | null
  result: Record<string, unknown> | null
  summary?: Record<string, unknown> | null
  isPublic: boolean
}

const TERMINAL_STATUSES = new Set([
  "complete",
  "recommended",
  "low_visibility",
  "not_mentioned",
  "failed",
])

const FAILURE_STATUSES = new Set(["failed"])

function isTerminal(status: string) {
  return TERMINAL_STATUSES.has(status)
}

function isFailed(status: string) {
  return FAILURE_STATUSES.has(status)
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function getScoreColor(score: number | null) {
  if (score === null) return { ring: "#e5e7eb", text: "text-gray-400" }
  if (score >= 70) return { ring: "#16a34a", text: "text-green-600" }
  if (score >= 40) return { ring: "#f59e0b", text: "text-amber-500" }
  return { ring: "#dc2626", text: "text-red-600" }
}

function getScoreLabel(score: number | null) {
  if (score === null) return "—"
  if (score >= 70) return "Strong"
  if (score >= 40) return "Moderate"
  if (score >= 20) return "Low"
  return "Invisible"
}

interface ProviderSourceData {
  mentioned?: boolean
  position?: "top_3" | "mentioned" | "not_found"
  description?: string | null
}

interface CompetitorResult {
  name: string
  mentioned?: boolean
  mentionCount?: number
  totalQueries?: number
  outranksUser?: boolean
}

// ─────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────

export function ResultView({
  initialScan,
  scanId,
}: {
  initialScan: PublicScanData
  scanId: string
}) {
  const [scan, setScan] = useState<PublicScanData>(initialScan)
  const [statusData, setStatusData] = useState<StatusResponse | null>(null)
  const [pollError, setPollError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [copied, setCopied] = useState(false)

  const status = statusData?.status || scan.status
  const isComplete = isTerminal(status) && !isFailed(status)
  const failed = isFailed(status)

  // Poll the status endpoint while the scan is in progress.
  useEffect(() => {
    if (isTerminal(status)) return

    let cancelled = false
    let attempts = 0
    const maxAttempts = 90 // ~3 minutes at 2s interval

    const poll = async () => {
      while (!cancelled && attempts < maxAttempts) {
        attempts++
        try {
          const res = await fetch(`/api/scan/${scanId}/status`, {
            cache: "no-store",
          })
          if (!res.ok) {
            if (res.status === 404) {
              setPollError("Scan not found")
              return
            }
            await new Promise((r) => setTimeout(r, 2500))
            continue
          }
          const data = (await res.json()) as StatusResponse
          if (cancelled) return
          setStatusData(data)
          if (isTerminal(data.status)) return
        } catch {
          /* network blip — retry */
        }
        await new Promise((r) => setTimeout(r, 2500))
      }
      if (!cancelled && attempts >= maxAttempts) {
        setPollError("This scan is taking longer than expected.")
      }
    }

    poll()

    return () => {
      cancelled = true
    }
  }, [scanId, status])

  // Track elapsed time for the in-progress UI.
  useEffect(() => {
    if (isTerminal(status)) return
    const start = Date.now()
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(t)
  }, [status])

  // Once the status response carries a final result, fold it back into scan.
  useEffect(() => {
    if (!statusData) return
    setScan((prev) => ({
      ...prev,
      status: statusData.status,
      stage: statusData.stage,
      progress: statusData.progress,
      score: statusData.score ?? prev.score,
      summary: statusData.summary ?? prev.summary,
    }))
  }, [statusData])

  // ── Derive renderable data from summary.legacy_result ──
  const legacy = useMemo(() => {
    const summary = scan.summary as Record<string, unknown> | null
    if (!summary) return null
    return (summary.legacy_result as Record<string, unknown> | null) || null
  }, [scan.summary])

  const profile = scan.saasProfile || {}
  const brandName = (profile.brand_name as string) || (legacy?.brandName as string) || "Brand"
  const score = scan.score ?? null
  const queryCount = scan.queryCount ?? (legacy?.query_count as number) ?? null

  const sources = (legacy?.sources || {}) as Record<string, ProviderSourceData>
  const visibilityScore = (legacy?.visibilityScore || {}) as {
    breakdown?: { mentionRate?: number; topThreeRate?: number; avgPosition?: number | null }
    byModel?: Record<string, number>
  }
  const breakdown = visibilityScore.breakdown || {}

  // ── Share copy & URL ──
  const shareUrl = typeof window !== "undefined" ? window.location.href : ""
  const shareCopy = useMemo(() => {
    if (score === null) {
      return `I just checked how AI describes ${brandName} across ChatGPT and Claude. Run yours →`
    }
    return `I just checked how AI describes ${brandName} across ChatGPT and Claude. Score: ${score}/100. Run yours →`
  }, [brandName, score])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }, [shareUrl])

  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareCopy)}&url=${encodeURIComponent(shareUrl)}`

  // ── Render ──
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
        {failed ? (
          <FailedState scanId={scanId} />
        ) : !isComplete ? (
          <InProgressState
            brandName={brandName}
            elapsed={elapsed}
            stage={statusData?.stage || scan.stage}
            progress={statusData?.progress ?? scan.progress}
            error={pollError}
          />
        ) : (
          <CompleteState
            brandName={brandName}
            score={score}
            queryCount={queryCount}
            profile={profile}
            sources={sources}
            visibilityScore={visibilityScore}
            breakdown={breakdown}
            legacy={legacy}
            shareUrl={shareUrl}
            shareCopy={shareCopy}
            linkedInUrl={linkedInUrl}
            twitterUrl={twitterUrl}
            copied={copied}
            onCopy={handleCopy}
          />
        )}
      </main>

      <Footer />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Header / Footer
// ─────────────────────────────────────────────────────────────────────

function Header() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-3xl px-6">
        <div className="flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Mentioned"
              width={26}
              height={26}
              className="rounded-md"
            />
            <span className="font-semibold text-gray-900 text-sm">Mentioned</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/scan"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Run your own scan
            </Link>
            <Link href="/signup">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
                Sign up free
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Mentioned"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <div>
              <div className="font-semibold text-gray-900">Mentioned</div>
              <div className="text-xs text-gray-500">
                Find out if AI is recommending your product.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/scan"
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Run a scan →
            </Link>
            <Link href="/signup">
              <Button className="bg-gray-900 hover:bg-gray-800 text-white rounded-lg">
                Track over time
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

// ─────────────────────────────────────────────────────────────────────
// In-progress state
// ─────────────────────────────────────────────────────────────────────

function InProgressState({
  brandName,
  elapsed,
  stage,
  progress,
  error,
}: {
  brandName: string
  elapsed: number
  stage: string | null
  progress: number
  error: string | null
}) {
  // Estimate ~90s typical, derive a polished % from elapsed so the bar moves
  // smoothly even if the backend hasn't pushed a `progress` update.
  const estimatedPct = Math.min(
    elapsed < 10 ? elapsed * 4 :
    elapsed < 60 ? 40 + (elapsed - 10) * 0.7 :
    elapsed < 120 ? 75 + (elapsed - 60) * 0.25 :
    90 + Math.min((elapsed - 120) * 0.1, 7),
    97,
  )
  const pct = Math.max(progress || 0, Math.round(estimatedPct))
  const remaining = Math.max(0, 90 - elapsed)

  const steps = [
    { id: "profile", label: "Scanning your website", at: 5 },
    { id: "queries", label: "Generating buyer-style AI queries", at: 20 },
    { id: "chatgpt", label: "Asking ChatGPT", at: 35 },
    { id: "claude", label: "Asking Claude", at: 55 },
    { id: "analysis", label: "Analyzing & scoring results", at: 80 },
  ]

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 sm:p-12 text-center">
      <div className="mb-6 flex justify-center">
        <div className="size-14 rounded-full bg-blue-50 flex items-center justify-center">
          <Loader2 className="size-7 text-blue-600 animate-spin" />
        </div>
      </div>

      <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">
        Checking AI visibility for {brandName}
      </h1>
      <p className="text-gray-600 mb-8">
        We&apos;re asking ChatGPT and Claude what they recommend — this usually
        takes about 90 seconds.
      </p>

      {/* Progress bar */}
      <div className="max-w-md mx-auto">
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-gray-700 font-medium">{pct}%</span>
          <span className="text-gray-500 inline-flex items-center gap-1.5">
            <Clock className="size-3.5" />
            {remaining > 0 ? `~${remaining}s remaining` : "Almost done…"}
          </span>
        </div>
      </div>

      {/* Steps */}
      <div className="mt-10 max-w-md mx-auto space-y-3 text-left">
        {steps.map((step) => {
          const completed = pct >= step.at + 15
          const active = !completed && pct >= step.at
          return (
            <div
              key={step.id}
              className={cn(
                "flex items-center gap-3 transition-opacity duration-300",
                !completed && !active && "opacity-40",
              )}
            >
              <div className="size-5 flex items-center justify-center">
                {completed ? (
                  <Check className="size-4 text-green-600" />
                ) : active ? (
                  <Loader2 className="size-4 text-blue-600 animate-spin" />
                ) : (
                  <div className="size-2 rounded-full bg-gray-300" />
                )}
              </div>
              <span
                className={cn(
                  "text-sm",
                  completed ? "text-gray-500" : active ? "text-gray-900 font-medium" : "text-gray-500",
                )}
              >
                {stage === step.id && active ? step.label + "…" : step.label}
              </span>
            </div>
          )
        })}
      </div>

      {error && (
        <div className="mt-8 p-4 rounded-lg bg-amber-50 border border-amber-200 text-left max-w-md mx-auto">
          <p className="text-sm text-amber-900 flex items-start gap-2">
            <AlertCircle className="size-4 mt-0.5 flex-shrink-0" />
            <span>{error} Try refreshing this page in a moment.</span>
          </p>
        </div>
      )}

      <p className="mt-12 text-xs text-gray-400">
        Tip: bookmark this page — the result will appear here automatically.
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Failed state
// ─────────────────────────────────────────────────────────────────────

function FailedState({ scanId }: { scanId: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center">
      <div className="mb-5 flex justify-center">
        <div className="size-14 rounded-full bg-red-50 flex items-center justify-center">
          <AlertCircle className="size-7 text-red-600" />
        </div>
      </div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">
        This scan didn&apos;t finish
      </h1>
      <p className="text-gray-600 mb-6">
        Something went wrong while running your scan. This is usually
        temporary — try running another one.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link href="/scan">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
            Run a new scan
          </Button>
        </Link>
        <Link href="/">
          <Button variant="secondary" className="rounded-lg">
            Back to home
          </Button>
        </Link>
      </div>
      <p className="mt-6 text-xs text-gray-400">Scan ID: {scanId}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Complete state — the big one
// ─────────────────────────────────────────────────────────────────────

function CompleteState({
  brandName,
  score,
  queryCount,
  profile,
  sources,
  visibilityScore,
  breakdown,
  legacy,
  shareUrl,
  shareCopy,
  linkedInUrl,
  twitterUrl,
  copied,
  onCopy,
}: {
  brandName: string
  score: number | null
  queryCount: number | null
  profile: Record<string, unknown>
  sources: Record<string, ProviderSourceData>
  visibilityScore: { breakdown?: { mentionRate?: number; topThreeRate?: number; avgPosition?: number | null }; byModel?: Record<string, number> }
  breakdown: { mentionRate?: number; topThreeRate?: number; avgPosition?: number | null }
  legacy: Record<string, unknown> | null
  shareUrl: string
  shareCopy: string
  linkedInUrl: string
  twitterUrl: string
  copied: boolean
  onCopy: () => void
}) {
  const scoreColor = getScoreColor(score)
  const label = getScoreLabel(score)
  const mentionRate = breakdown.mentionRate ?? 0
  const websiteUrl = (profile.website_url as string) || ""

  // Mentioned-in-X-of-Y
  const mentionedQueries = computeMentionedQueries(legacy, queryCount)

  // Top findings — 3 to 5 strong bullets derived from the data.
  const findings = computeFindings({
    score,
    brandName,
    mentionRate,
    sources,
    legacy,
    mentionedQueries,
  })

  // Competitor comparison
  const competitors = ((legacy?.competitor_results as CompetitorResult[]) || [])
    .filter((c) => c.name && c.mentionCount && c.mentionCount > 0)
    .sort((a, b) => (b.mentionCount || 0) - (a.mentionCount || 0))
    .slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Hero / Score card */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 sm:p-10">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8">
          {/* Score ring */}
          <div className="flex-shrink-0">
            <ScoreRing score={score} color={scoreColor.ring} />
          </div>

          <div className="flex-1 text-center sm:text-left min-w-0">
            <div className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-1">
              AI Visibility Report
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 break-words">
              {brandName}
            </h1>
            {websiteUrl && (
              <a
                href={websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-500 hover:text-gray-900 transition-colors mt-1 inline-block break-all"
              >
                {websiteUrl.replace(/^https?:\/\//, "")}
              </a>
            )}
            <p className="text-base sm:text-lg text-gray-700 mt-4">
              <span className={cn("font-semibold", scoreColor.text)}>{label}</span> visibility —
              cited in {mentionedQueries.toLocaleString()} of {(queryCount ?? 0).toLocaleString()} buyer-style AI queries.
            </p>
          </div>
        </div>

        {/* Share strip */}
        <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="text-sm text-gray-500 flex-1">
            Share this report
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onCopy}
              className={cn(
                "inline-flex items-center gap-2 h-9 px-4 rounded-lg border text-sm font-medium transition-colors",
                copied
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50",
              )}
            >
              {copied ? (
                <>
                  <CheckCircle2 className="size-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="size-4" />
                  Copy link
                </>
              )}
            </button>
            <a
              href={linkedInUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 text-sm font-medium transition-colors"
            >
              <Linkedin className="size-4" />
              LinkedIn
            </a>
            <a
              href={twitterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 text-sm font-medium transition-colors"
            >
              <Twitter className="size-4" />
              X
            </a>
          </div>
        </div>
      </section>

      {/* Provider breakdown */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          How each AI cites {brandName}
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          What ChatGPT and Claude said when buyers asked about your category.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ProviderCard
            providerKey="chatgpt"
            providerLabel="ChatGPT"
            providerInitial="G"
            providerColor="emerald"
            data={sources.chatgpt}
            visibilityScore={visibilityScore.byModel?.chatgpt}
          />
          <ProviderCard
            providerKey="claude"
            providerLabel="Claude"
            providerInitial="C"
            providerColor="amber"
            data={sources.claude}
            visibilityScore={visibilityScore.byModel?.claude}
          />
        </div>
      </section>

      {/* Top findings */}
      {findings.length > 0 && (
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Top findings</h2>
          <p className="text-sm text-gray-500 mb-6">
            What jumps out from this scan.
          </p>
          <ul className="space-y-3">
            {findings.map((f, i) => (
              <li key={i} className="flex items-start gap-3">
                <div
                  className={cn(
                    "mt-1 size-5 rounded-full flex items-center justify-center flex-shrink-0",
                    f.tone === "positive"
                      ? "bg-green-100 text-green-700"
                      : f.tone === "negative"
                      ? "bg-red-100 text-red-700"
                      : "bg-blue-100 text-blue-700",
                  )}
                >
                  <Check className="size-3" />
                </div>
                <span className="text-sm text-gray-800 leading-relaxed">
                  {f.text}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Competitor comparison */}
      {competitors.length > 0 && (
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            Who AI mentions in your space
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Brands that came up alongside (or instead of) {brandName}.
          </p>
          <div className="space-y-3">
            {competitors.map((c) => {
              const total = c.totalQueries || queryCount || 1
              const pct = Math.round(((c.mentionCount || 0) / total) * 100)
              return (
                <div key={c.name} className="flex items-center gap-4">
                  <div className="w-32 sm:w-44 text-sm font-medium text-gray-800 truncate">
                    {c.name}
                  </div>
                  <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        c.outranksUser ? "bg-red-500" : "bg-gray-400",
                      )}
                      style={{ width: `${Math.max(pct, 4)}%` }}
                    />
                  </div>
                  <div className="w-20 text-sm text-gray-600 text-right tabular-nums">
                    {c.mentionCount}/{total}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="mt-6 text-xs text-gray-400">
            Mentions across {queryCount} buyer-style AI queries.
          </p>
        </section>
      )}

      {/* Conversion CTA — soft */}
      <section className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl shadow-lg p-8 sm:p-10 text-white">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-semibold uppercase tracking-wider mb-4">
            <TrendingUp className="size-3.5" />
            Track this over time
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">
            See how {brandName}&apos;s score changes week to week
          </h2>
          <p className="text-blue-50 mb-6">
            This snapshot is just one moment. Sign up free to monitor weekly,
            see what&apos;s driving change, and get a fix-it plan tailored to
            your gaps.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={`/signup?source=public-scan&brand=${encodeURIComponent(brandName)}`}
            >
              <Button
                size="lg"
                className="bg-white text-blue-700 hover:bg-blue-50 rounded-xl font-semibold"
              >
                Sign up free
                <ArrowRight className="ml-1" />
              </Button>
            </Link>
            <Link
              href={`/scan?brand=${encodeURIComponent(brandName)}`}
            >
              <Button
                size="lg"
                variant="ghost"
                className="text-white hover:bg-white/10 rounded-xl font-semibold border border-white/30"
              >
                Run another scan
              </Button>
            </Link>
          </div>
          <p className="mt-5 text-xs text-blue-100/70 inline-flex items-center gap-1.5">
            <Lock className="size-3" />
            No credit card · Free forever for one tracked brand
          </p>
        </div>
      </section>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────

function ScoreRing({ score, color }: { score: number | null; color: string }) {
  const size = 140
  const strokeWidth = 12
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const pct = score === null ? 0 : Math.max(0, Math.min(100, score))
  const offset = circumference * (1 - pct / 100)

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f3f4f6"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold text-gray-900 tabular-nums">
          {score === null ? "—" : score}
        </span>
        <span className="text-xs text-gray-500 font-medium">/ 100</span>
      </div>
    </div>
  )
}

function ProviderCard({
  providerLabel,
  providerInitial,
  providerColor,
  data,
  visibilityScore,
}: {
  providerKey: string
  providerLabel: string
  providerInitial: string
  providerColor: "emerald" | "amber"
  data: ProviderSourceData | undefined
  visibilityScore?: number
}) {
  const mentioned = data?.mentioned ?? false
  const position = data?.position ?? "not_found"
  const description = data?.description ?? null

  const colors =
    providerColor === "emerald"
      ? { bg: "bg-emerald-50", border: "border-emerald-100", text: "text-emerald-700" }
      : { bg: "bg-amber-50", border: "border-amber-100", text: "text-amber-700" }

  const positionLabel =
    position === "top_3"
      ? "Top 3"
      : mentioned
      ? "Mentioned"
      : "Not mentioned"

  const positionTone = mentioned ? "text-green-700 bg-green-50" : "text-gray-500 bg-gray-100"

  return (
    <div className="rounded-xl border border-gray-200 p-5 bg-white">
      <div className="flex items-center gap-3 mb-3">
        <div
          className={cn(
            "size-9 rounded-lg flex items-center justify-center font-bold text-base border",
            colors.bg,
            colors.border,
            colors.text,
          )}
        >
          {providerInitial}
        </div>
        <div className="flex-1">
          <div className="font-semibold text-gray-900">{providerLabel}</div>
          {visibilityScore !== undefined && (
            <div className="text-xs text-gray-500">
              Visibility score: {Math.round(visibilityScore)}/100
            </div>
          )}
        </div>
        <span
          className={cn(
            "text-xs font-semibold px-2 py-1 rounded-full",
            positionTone,
          )}
        >
          {positionLabel}
        </span>
      </div>
      <div className="text-sm text-gray-700">
        {description || (mentioned ? "Cited as a relevant option." : "No mentions in any of the buyer-style queries we tested.")}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────

function computeMentionedQueries(
  legacy: Record<string, unknown> | null,
  queryCount: number | null,
): number {
  if (!legacy) return 0
  const tested = (legacy.queries_tested as Array<Record<string, unknown>> | undefined) || []
  if (Array.isArray(tested) && tested.length > 0) {
    return tested.filter((q) => q.chatgpt || q.claude || q.gemini).length
  }
  // Fallback: derive from mention rate * queryCount
  const breakdown = (legacy.visibilityScore as { breakdown?: { mentionRate?: number } } | undefined)
    ?.breakdown
  const rate = breakdown?.mentionRate ?? 0
  return Math.round(((rate / 100) * (queryCount || 0)) || 0)
}

interface Finding {
  text: string
  tone: "positive" | "negative" | "neutral"
}

function computeFindings({
  score,
  brandName,
  mentionRate,
  sources,
  legacy,
  mentionedQueries,
}: {
  score: number | null
  brandName: string
  mentionRate: number
  sources: Record<string, ProviderSourceData>
  legacy: Record<string, unknown> | null
  mentionedQueries: number
}): Finding[] {
  const findings: Finding[] = []
  const chatgpt = sources.chatgpt
  const claude = sources.claude

  // 1) Headline finding
  if (score !== null) {
    if (score >= 70) {
      findings.push({
        text: `${brandName} has strong AI visibility — top-tier placement when buyers ask AI for tools in your category.`,
        tone: "positive",
      })
    } else if (score >= 40) {
      findings.push({
        text: `${brandName} is showing up in AI answers, but inconsistently — there's clear room to push from "mentioned" to "recommended".`,
        tone: "neutral",
      })
    } else if (score >= 20) {
      findings.push({
        text: `${brandName} has low AI visibility today — your category competitors are getting most of the recommendation traffic.`,
        tone: "negative",
      })
    } else {
      findings.push({
        text: `${brandName} is essentially invisible in AI answers — buyers asking ChatGPT and Claude in your category never hear about you.`,
        tone: "negative",
      })
    }
  }

  // 2) Mention rate breakdown
  if (mentionRate > 0) {
    findings.push({
      text: `Mentioned in ${mentionedQueries} of the buyer-style queries we tested (${Math.round(mentionRate)}% mention rate).`,
      tone: mentionRate >= 50 ? "positive" : mentionRate >= 25 ? "neutral" : "negative",
    })
  }

  // 3) Provider gap
  if (chatgpt?.mentioned && !claude?.mentioned) {
    findings.push({
      text: `Found in ChatGPT but missing in Claude — Anthropic's model isn't picking up on ${brandName} yet.`,
      tone: "neutral",
    })
  } else if (claude?.mentioned && !chatgpt?.mentioned) {
    findings.push({
      text: `Found in Claude but missing in ChatGPT — OpenAI's model isn't surfacing ${brandName} in this category.`,
      tone: "neutral",
    })
  } else if (chatgpt?.mentioned && claude?.mentioned) {
    findings.push({
      text: `Cited by both ChatGPT and Claude — model agreement signals strong category presence.`,
      tone: "positive",
    })
  }

  // 4) Competitor density
  const competitors = (legacy?.competitor_results as CompetitorResult[]) || []
  const dominantCompetitor = competitors
    .filter((c) => c.outranksUser && c.mentionCount && c.mentionCount > 0)
    .sort((a, b) => (b.mentionCount || 0) - (a.mentionCount || 0))[0]
  if (dominantCompetitor) {
    findings.push({
      text: `${dominantCompetitor.name} dominates AI recommendations in your category — appearing in ${dominantCompetitor.mentionCount} of the same queries you missed.`,
      tone: "negative",
    })
  }

  // 5) Top-3 position insight
  const breakdown = (legacy?.visibilityScore as { breakdown?: { topThreeRate?: number } } | undefined)?.breakdown
  if (breakdown?.topThreeRate && breakdown.topThreeRate > 0) {
    findings.push({
      text: `When AI does mention ${brandName}, ${breakdown.topThreeRate}% of those mentions are top-3 picks.`,
      tone: breakdown.topThreeRate >= 50 ? "positive" : "neutral",
    })
  }

  return findings.slice(0, 5)
}
