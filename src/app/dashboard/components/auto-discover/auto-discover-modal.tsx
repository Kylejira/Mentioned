'use client'

import { useState, useEffect, useCallback, useRef } from "react"
import { cn } from "@/lib/utils"
import {
  X,
  Search,
  Loader2,
  Check,
  CheckCircle2,
  Circle,
  Sparkles,
  Globe,
  Brain,
  MessageSquare,
  Pencil,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  ArrowRight,
  Rocket,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QueryItem {
  query: string
  intent: string
  platform_fit: string
  selected: boolean
  edited: boolean
}

interface ProductProfile {
  product_name: string
  category: string
  subcategory: string
  problem_solved: string
  target_audience: string
  key_features: string[]
  differentiators: string[]
  competitors: string[]
  keywords: string[]
  pricing_model: string
  tone: string
  extraction_confidence?: string
  source_url: string
}

type Step = "url_input" | "manual_input" | "analyzing" | "query_review" | "activating" | "done"

interface AutoDiscoverModalProps {
  open: boolean
  onClose: () => void
  onScanCreated: (scanId: string) => void
}

// ---------------------------------------------------------------------------
// Intent config
// ---------------------------------------------------------------------------

const INTENT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  recommendation: { bg: "bg-blue-100", text: "text-blue-700", label: "Recommendation" },
  alternative: { bg: "bg-purple-100", text: "text-purple-700", label: "Alternative" },
  problem: { bg: "bg-amber-100", text: "text-amber-700", label: "Problem" },
  comparison: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Comparison" },
  discovery: { bg: "bg-gray-100", text: "text-gray-600", label: "Discovery" },
}

// ---------------------------------------------------------------------------
// Main Modal
// ---------------------------------------------------------------------------

export function AutoDiscoverModal({ open, onClose, onScanCreated }: AutoDiscoverModalProps) {
  const [step, setStep] = useState<Step>("url_input")
  const [url, setUrl] = useState("")
  const [error, setError] = useState<string | null>(null)

  // Manual fallback state
  const [manualName, setManualName] = useState("")
  const [manualDescription, setManualDescription] = useState("")
  const [manualCategory, setManualCategory] = useState("")
  const [manualCompetitors, setManualCompetitors] = useState("")

  // Analyzing step progress
  const [analyzeSteps, setAnalyzeSteps] = useState<Array<{ label: string; status: "pending" | "done" | "active" }>>([])

  // Query review state
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [profile, setProfile] = useState<ProductProfile | null>(null)
  const [queries, setQueries] = useState<QueryItem[]>([])
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState("")

  // Activation state
  const [activationError, setActivationError] = useState<string | null>(null)

  // Reset on open/close
  useEffect(() => {
    if (open) {
      setStep("url_input")
      setUrl("")
      setError(null)
      setManualName("")
      setManualDescription("")
      setManualCategory("")
      setManualCompetitors("")
      setAnalyzeSteps([])
      setSessionId(null)
      setProfile(null)
      setQueries([])
      setEditingIndex(null)
      setActivationError(null)
    }
  }, [open])

  // Escape to close
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open, onClose])

  // Prevent body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
      return () => { document.body.style.overflow = "" }
    }
  }, [open])

  // ── URL discovery flow ──
  const handleDiscover = useCallback(async () => {
    if (!url.trim()) return
    setError(null)
    setStep("analyzing")

    setAnalyzeSteps([
      { label: "Fetching website content", status: "active" },
      { label: "Extracting product information", status: "pending" },
      { label: "Generating discovery queries", status: "pending" },
    ])

    // Simulate progress while the API runs
    const progressTimer1 = setTimeout(() => {
      setAnalyzeSteps((prev) => [
        { ...prev[0], status: "done" },
        { ...prev[1], status: "active" },
        prev[2],
      ])
    }, 2000)

    const progressTimer2 = setTimeout(() => {
      setAnalyzeSteps((prev) => [
        prev[0],
        { ...prev[1], status: "done" },
        { ...prev[2], status: "active" },
      ])
    }, 5000)

    try {
      const res = await fetch("/api/auto-discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      })

      clearTimeout(progressTimer1)
      clearTimeout(progressTimer2)

      const data = await res.json()

      if (!res.ok) {
        if (data.fallback === "manual") {
          setError(data.message)
          setStep("manual_input")
          return
        }
        throw new Error(data.message || data.error || "Discovery failed")
      }

      if (data.fallback === "edit_profile") {
        // Low confidence — prefill manual form with extracted data
        const p = data.profile as ProductProfile
        setManualName(p.product_name)
        setManualDescription(p.problem_solved)
        setManualCategory(p.category)
        setManualCompetitors(p.competitors.join(", "))
        setError(data.message)
        setStep("manual_input")
        return
      }

      setAnalyzeSteps([
        { label: "Fetching website content", status: "done" },
        { label: "Extracting product information", status: "done" },
        { label: "Generating discovery queries", status: "done" },
      ])

      setSessionId(data.session_id)
      setProfile(data.profile)
      setQueries(data.queries)

      // Brief pause to show all checkmarks
      setTimeout(() => setStep("query_review"), 600)
    } catch (err) {
      clearTimeout(progressTimer1)
      clearTimeout(progressTimer2)
      setError(err instanceof Error ? err.message : "Discovery failed. Please try again.")
      setStep("url_input")
    }
  }, [url])

  // ── Manual fallback flow ──
  const handleManualDiscover = useCallback(async () => {
    if (!manualName.trim() || !manualDescription.trim() || !manualCategory.trim()) return
    setError(null)
    setStep("analyzing")

    setAnalyzeSteps([
      { label: "Processing product information", status: "active" },
      { label: "Generating discovery queries", status: "pending" },
    ])

    const progressTimer = setTimeout(() => {
      setAnalyzeSteps((prev) => [
        { ...prev[0], status: "done" },
        { ...prev[1], status: "active" },
      ])
    }, 2000)

    try {
      const competitors = manualCompetitors
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)

      const res = await fetch("/api/auto-discover/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_name: manualName.trim(),
          description: manualDescription.trim(),
          category: manualCategory.trim(),
          competitors,
          source_url: url.trim() || undefined,
        }),
      })

      clearTimeout(progressTimer)

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || data.error || "Discovery failed")
      }

      setAnalyzeSteps([
        { label: "Processing product information", status: "done" },
        { label: "Generating discovery queries", status: "done" },
      ])

      setSessionId(data.session_id)
      setProfile(data.profile)
      setQueries(data.queries)

      setTimeout(() => setStep("query_review"), 600)
    } catch (err) {
      clearTimeout(progressTimer)
      setError(err instanceof Error ? err.message : "Discovery failed. Please try again.")
      setStep("manual_input")
    }
  }, [manualName, manualDescription, manualCategory, manualCompetitors, url])

  // ── Activate selected queries ──
  const handleActivate = useCallback(async () => {
    if (!sessionId) return
    const selected = queries.filter((q) => q.selected)
    if (selected.length === 0) return

    setActivationError(null)
    setStep("activating")

    try {
      const res = await fetch("/api/auto-discover/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          selected_queries: selected.map((q) => ({
            query: q.query,
            intent: q.intent,
            platform_fit: q.platform_fit,
          })),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.upgradeRequired) {
          setActivationError("You've used your free scan. Upgrade to run more scans.")
        } else {
          throw new Error(data.message || data.error || "Activation failed")
        }
        setStep("query_review")
        return
      }

      setStep("done")

      // Navigate to progress/dashboard after a brief success message
      setTimeout(() => {
        onScanCreated(data.scan_id)
      }, 2000)
    } catch (err) {
      setActivationError(err instanceof Error ? err.message : "Failed to create scan")
      setStep("query_review")
    }
  }, [sessionId, queries, onScanCreated])

  // ── Query helpers ──
  const toggleQuery = (index: number) => {
    setQueries((prev) => prev.map((q, i) => (i === index ? { ...q, selected: !q.selected } : q)))
  }

  const selectAll = () => setQueries((prev) => prev.map((q) => ({ ...q, selected: true })))
  const deselectAll = () => setQueries((prev) => prev.map((q) => ({ ...q, selected: false })))

  const startEdit = (index: number) => {
    setEditingIndex(index)
    setEditValue(queries[index].query)
  }

  const saveEdit = () => {
    if (editingIndex === null) return
    if (editValue.trim()) {
      setQueries((prev) =>
        prev.map((q, i) =>
          i === editingIndex ? { ...q, query: editValue.trim(), edited: true } : q
        )
      )
    }
    setEditingIndex(null)
    setEditValue("")
  }

  const cancelEdit = () => {
    setEditingIndex(null)
    setEditValue("")
  }

  const selectedCount = queries.filter((q) => q.selected).length

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-blue-500" />
            <h2 className="text-lg font-bold text-gray-900">Auto Discover Queries</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition p-1">
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 min-h-0">
          {step === "url_input" && (
            <UrlInputStep
              url={url}
              setUrl={setUrl}
              error={error}
              onDiscover={handleDiscover}
              onManual={() => {
                setError(null)
                setStep("manual_input")
              }}
            />
          )}

          {step === "manual_input" && (
            <ManualInputStep
              name={manualName}
              setName={setManualName}
              description={manualDescription}
              setDescription={setManualDescription}
              category={manualCategory}
              setCategory={setManualCategory}
              competitors={manualCompetitors}
              setCompetitors={setManualCompetitors}
              error={error}
              onDiscover={handleManualDiscover}
              onBack={() => {
                setError(null)
                setStep("url_input")
              }}
            />
          )}

          {step === "analyzing" && (
            <AnalyzingStep url={url} steps={analyzeSteps} />
          )}

          {step === "query_review" && profile && (
            <QueryReviewStep
              profile={profile}
              queries={queries}
              selectedCount={selectedCount}
              editingIndex={editingIndex}
              editValue={editValue}
              activationError={activationError}
              onToggle={toggleQuery}
              onSelectAll={selectAll}
              onDeselectAll={deselectAll}
              onStartEdit={startEdit}
              onSaveEdit={saveEdit}
              onCancelEdit={cancelEdit}
              onEditValueChange={setEditValue}
              onActivate={handleActivate}
            />
          )}

          {step === "activating" && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="size-8 text-blue-500 animate-spin" />
              <p className="text-gray-600 font-medium">Creating your scan...</p>
              <p className="text-sm text-gray-400">
                Running {selectedCount} queries through AI providers
              </p>
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="size-16 bg-green-100 rounded-full flex items-center justify-center">
                <Check className="size-8 text-green-600" />
              </div>
              <p className="text-xl font-bold text-gray-900">Scan Created!</p>
              <p className="text-sm text-gray-500 text-center max-w-sm">
                Your {selectedCount} discovery queries are being scanned across AI providers.
                Results will appear on your dashboard shortly.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 1: URL Input
// ---------------------------------------------------------------------------

function UrlInputStep({
  url,
  setUrl,
  error,
  onDiscover,
  onManual,
}: {
  url: string
  setUrl: (v: string) => void
  error: string | null
  onDiscover: () => void
  onManual: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="flex flex-col items-center">
      <div className="size-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
        <Globe className="size-6 text-blue-600" />
      </div>
      <p className="text-gray-600 text-center max-w-md mb-6">
        Enter your product&apos;s website URL and we&apos;ll generate high-intent discovery queries automatically.
      </p>

      {error && (
        <div className="w-full bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="w-full max-w-md">
        <input
          ref={inputRef}
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onDiscover()}
          placeholder="https://your-product.com"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
        />
      </div>

      <div className="flex items-center gap-4 mt-6">
        <button
          onClick={onDiscover}
          disabled={!url.trim()}
          className={cn(
            "inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm",
            url.trim()
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          )}
        >
          <Search className="size-4" />
          Discover Queries
        </button>
        <span className="text-sm text-gray-400">or</span>
        <button
          onClick={onManual}
          className="text-sm font-medium text-gray-500 hover:text-gray-700 transition underline"
        >
          Enter manually instead
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 1b: Manual Input (fallback)
// ---------------------------------------------------------------------------

function ManualInputStep({
  name,
  setName,
  description,
  setDescription,
  category,
  setCategory,
  competitors,
  setCompetitors,
  error,
  onDiscover,
  onBack,
}: {
  name: string
  setName: (v: string) => void
  description: string
  setDescription: (v: string) => void
  category: string
  setCategory: (v: string) => void
  competitors: string
  setCompetitors: (v: string) => void
  error: string | null
  onDiscover: () => void
  onBack: () => void
}) {
  const canSubmit = name.trim() && description.trim() && category.trim()

  return (
    <div>
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition mb-4"
      >
        <ArrowLeft className="size-3.5" />
        Back to URL input
      </button>

      <h3 className="text-base font-bold text-gray-900 mb-1">Describe your product</h3>
      <p className="text-sm text-gray-500 mb-5">
        We&apos;ll generate discovery queries based on your description.
      </p>

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
          <p className="text-sm text-amber-700">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Product name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Pika"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">What does it do? *</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., AI video generation tool that creates videos from text prompts"
            rows={2}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g., AI video generation"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Competitors <span className="text-gray-400 font-normal">(comma-separated, optional)</span>
          </label>
          <input
            type="text"
            value={competitors}
            onChange={(e) => setCompetitors(e.target.value)}
            placeholder="e.g., Runway, Synthesia, Kling"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      <div className="mt-6">
        <button
          onClick={onDiscover}
          disabled={!canSubmit}
          className={cn(
            "inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm",
            canSubmit
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          )}
        >
          <Sparkles className="size-4" />
          Generate Queries
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 2: Analyzing (progressive loading)
// ---------------------------------------------------------------------------

function AnalyzingStep({
  url,
  steps,
}: {
  url: string
  steps: Array<{ label: string; status: "pending" | "done" | "active" }>
}) {
  const displayUrl = url.replace(/^https?:\/\//, "")

  return (
    <div className="flex flex-col items-center py-8">
      <Loader2 className="size-10 text-blue-500 animate-spin mb-6" />
      <p className="text-gray-900 font-semibold mb-1">
        Analyzing {displayUrl}...
      </p>
      <p className="text-sm text-gray-400 mb-8">This usually takes 10–15 seconds</p>

      <div className="w-full max-w-xs space-y-3">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-3">
            {s.status === "done" && (
              <CheckCircle2 className="size-5 text-green-500 shrink-0" />
            )}
            {s.status === "active" && (
              <Loader2 className="size-5 text-blue-500 animate-spin shrink-0" />
            )}
            {s.status === "pending" && (
              <Circle className="size-5 text-gray-300 shrink-0" />
            )}
            <span
              className={cn(
                "text-sm",
                s.status === "done" && "text-green-700",
                s.status === "active" && "text-gray-900 font-medium",
                s.status === "pending" && "text-gray-400"
              )}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 3: Query Review
// ---------------------------------------------------------------------------

function QueryReviewStep({
  profile,
  queries,
  selectedCount,
  editingIndex,
  editValue,
  activationError,
  onToggle,
  onSelectAll,
  onDeselectAll,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onEditValueChange,
  onActivate,
}: {
  profile: ProductProfile
  queries: QueryItem[]
  selectedCount: number
  editingIndex: number | null
  editValue: string
  activationError: string | null
  onToggle: (i: number) => void
  onSelectAll: () => void
  onDeselectAll: () => void
  onStartEdit: (i: number) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onEditValueChange: (v: string) => void
  onActivate: () => void
}) {
  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <h3 className="text-base font-bold text-gray-900 mb-1">
          We found {queries.length} discovery queries for {profile.product_name}
        </h3>
        <p className="text-sm text-gray-500">
          <span className="font-medium text-gray-700">{profile.product_name}</span>
          {" "}&middot;{" "}
          {profile.category}
        </p>
      </div>

      {activationError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
          <p className="text-sm text-red-700">{activationError}</p>
        </div>
      )}

      {/* Select all / deselect all */}
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={onSelectAll}
          className="text-xs font-medium text-blue-600 hover:text-blue-700 transition"
        >
          Select All
        </button>
        <span className="text-gray-300">|</span>
        <button
          onClick={onDeselectAll}
          className="text-xs font-medium text-gray-400 hover:text-gray-600 transition"
        >
          Deselect All
        </button>
        <span className="flex-1" />
        <span className="text-xs text-gray-400">{selectedCount} selected</span>
      </div>

      {/* Query list */}
      <div className="space-y-2 mb-6">
        {queries.map((q, i) => (
          <QueryRow
            key={i}
            query={q}
            index={i}
            isEditing={editingIndex === i}
            editValue={editValue}
            onToggle={() => onToggle(i)}
            onStartEdit={() => onStartEdit(i)}
            onSaveEdit={onSaveEdit}
            onCancelEdit={onCancelEdit}
            onEditValueChange={onEditValueChange}
          />
        ))}
      </div>

      {/* Activate button */}
      <div className="sticky bottom-0 bg-white pt-3 border-t border-gray-100">
        <button
          onClick={onActivate}
          disabled={selectedCount === 0}
          className={cn(
            "w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition shadow-sm",
            selectedCount > 0
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          )}
        >
          <Rocket className="size-4" />
          Create Scan with {selectedCount} {selectedCount === 1 ? "Query" : "Queries"}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// QueryRow — single query with checkbox, edit, intent badge
// ---------------------------------------------------------------------------

function QueryRow({
  query,
  index,
  isEditing,
  editValue,
  onToggle,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onEditValueChange,
}: {
  query: QueryItem
  index: number
  isEditing: boolean
  editValue: string
  onToggle: () => void
  onStartEdit: () => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onEditValueChange: (v: string) => void
}) {
  const intentConfig = INTENT_COLORS[query.intent] || INTENT_COLORS.discovery
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) {
      editInputRef.current?.focus()
      editInputRef.current?.select()
    }
  }, [isEditing])

  return (
    <div
      className={cn(
        "rounded-xl border p-3 transition",
        query.selected
          ? "border-blue-200 bg-blue-50/30"
          : "border-gray-100 bg-gray-50/50 opacity-60"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button onClick={onToggle} className="mt-0.5 shrink-0">
          {query.selected ? (
            <div className="size-5 rounded-md bg-blue-600 flex items-center justify-center">
              <Check className="size-3 text-white" />
            </div>
          ) : (
            <div className="size-5 rounded-md border-2 border-gray-300" />
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                ref={editInputRef}
                type="text"
                value={editValue}
                onChange={(e) => onEditValueChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSaveEdit()
                  if (e.key === "Escape") onCancelEdit()
                }}
                className="flex-1 px-2 py-1 rounded-lg border border-blue-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <button onClick={onSaveEdit} className="text-xs font-medium text-blue-600 hover:text-blue-700">
                Save
              </button>
              <button onClick={onCancelEdit} className="text-xs text-gray-400 hover:text-gray-600">
                Cancel
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-900 leading-relaxed">
              {query.query}
              {query.edited && (
                <span className="text-[10px] text-gray-400 ml-1.5">(edited)</span>
              )}
            </p>
          )}

          {/* Badges */}
          <div className="flex items-center gap-2 mt-1.5">
            <span
              className={cn(
                "text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider",
                intentConfig.bg,
                intentConfig.text
              )}
            >
              {intentConfig.label}
            </span>
            <span className="text-[10px] text-gray-400">
              {query.platform_fit === "both"
                ? "Reddit + Twitter"
                : query.platform_fit === "reddit"
                  ? "Reddit"
                  : "Twitter"}
            </span>
          </div>
        </div>

        {/* Edit button */}
        {!isEditing && (
          <button
            onClick={onStartEdit}
            className="shrink-0 text-gray-300 hover:text-gray-500 transition mt-0.5"
            title="Edit query"
          >
            <Pencil className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
