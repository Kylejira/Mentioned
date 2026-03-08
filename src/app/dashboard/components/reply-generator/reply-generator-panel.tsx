'use client'

import { useState, useEffect, useRef, useCallback } from "react"
import { cn } from "@/lib/utils"
import {
  X,
  Loader2,
  Copy,
  Check,
  Pencil,
  RefreshCw,
  ChevronDown,
  Sparkles,
  Lock,
  MessageSquare,
  AlertCircle,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GeneratedReply {
  text: string
  mentions_product: boolean
  approach: string
}

interface ConversationData {
  id: string
  title?: string
  text: string
  platform: string
  opportunity_score: number
}

interface ReplyGeneratorPanelProps {
  conversation: ConversationData | null
  open: boolean
  onClose: () => void
  isPaidUser: boolean
  onUpgrade?: () => void
}

type Tone = "casual" | "professional" | "helpful" | "expert"

const TONE_OPTIONS: Array<{ value: Tone; label: string }> = [
  { value: "helpful", label: "Helpful" },
  { value: "casual", label: "Casual" },
  { value: "professional", label: "Professional" },
  { value: "expert", label: "Expert" },
]

// ---------------------------------------------------------------------------
// ReplyGeneratorPanel
// ---------------------------------------------------------------------------

export function ReplyGeneratorPanel({
  conversation,
  open,
  onClose,
  isPaidUser,
  onUpgrade,
}: ReplyGeneratorPanelProps) {
  const [replies, setReplies] = useState<GeneratedReply[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tone, setTone] = useState<Tone>("helpful")
  const [showToneMenu, setShowToneMenu] = useState(false)
  const [dailyRemaining, setDailyRemaining] = useState<number | null>(null)
  const [productAlreadyMentioned, setProductAlreadyMentioned] = useState(false)

  // Per-reply state
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState("")
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null)

  const panelRef = useRef<HTMLDivElement>(null)

  // Reset state when conversation changes or panel closes
  useEffect(() => {
    if (!open) {
      setReplies([])
      setError(null)
      setIsGenerating(false)
      setEditingIndex(null)
      setCopiedIndex(null)
      setRegeneratingIndex(null)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [open, onClose])

  // Lock body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
      return () => { document.body.style.overflow = "" }
    }
  }, [open])

  const handleGenerate = useCallback(async () => {
    if (!conversation || !isPaidUser) return

    setIsGenerating(true)
    setError(null)
    setReplies([])
    setEditingIndex(null)

    try {
      const res = await fetch("/api/generate-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversation.id,
          tone_override: tone,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (res.status === 403 && data.code === "PLAN_REQUIRED") {
          setError("upgrade_required")
        } else if (res.status === 429) {
          setError(data.error || "Daily limit reached")
        } else if (res.status === 400 && data.error?.includes("product profile")) {
          setError("no_profile")
        } else {
          setError(data.error || "Generation failed")
        }
        return
      }

      const data = await res.json()
      setReplies(data.replies || [])
      setDailyRemaining(data.daily_remaining ?? null)
      setProductAlreadyMentioned(data.product_already_mentioned || false)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setIsGenerating(false)
    }
  }, [conversation, isPaidUser, tone])

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    } catch {
      // fallback
    }
  }

  const startEdit = (index: number) => {
    setEditingIndex(index)
    setEditValue(replies[index].text)
  }

  const saveEdit = () => {
    if (editingIndex === null) return
    setReplies((prev) =>
      prev.map((r, i) => (i === editingIndex ? { ...r, text: editValue } : r))
    )
    setEditingIndex(null)
  }

  const handleRegenerateAll = () => {
    handleGenerate()
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Slide-out panel */}
      <div
        ref={panelRef}
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-blue-500" />
            <h2 className="font-semibold text-gray-900">Generate Reply</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Conversation context */}
          {conversation && (
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <MessageSquare className="size-3.5 text-gray-400" />
                <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                  Thread
                </span>
                <span className="text-[11px] text-gray-400">
                  {conversation.platform} &middot; Score {conversation.opportunity_score}
                </span>
              </div>
              {conversation.title && (
                <h4 className="text-sm font-semibold text-gray-900 mb-1">
                  {conversation.title}
                </h4>
              )}
              <p className="text-sm text-gray-600 line-clamp-3">{conversation.text}</p>
            </div>
          )}

          {/* Product already mentioned notice */}
          {productAlreadyMentioned && replies.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-700 flex items-start gap-2">
              <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
              Your product is already mentioned in this thread. Replies focus on adding value without re-mentioning it.
            </div>
          )}

          {/* Tone selector + generate button */}
          {!isPaidUser ? (
            <div className="bg-gray-50 rounded-xl p-6 text-center space-y-3">
              <Lock className="size-8 text-gray-300 mx-auto" />
              <p className="text-sm text-gray-600 font-medium">
                Reply generation requires a paid plan
              </p>
              <p className="text-xs text-gray-400">
                Upgrade to generate natural, helpful replies that mention your product.
              </p>
              {onUpgrade && (
                <button
                  onClick={onUpgrade}
                  className="bg-blue-600 text-white rounded-xl px-5 py-2 text-sm font-medium hover:bg-blue-700 transition"
                >
                  Upgrade Plan
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {/* Tone dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowToneMenu(!showToneMenu)}
                  className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50"
                >
                  Tone: {TONE_OPTIONS.find((t) => t.value === tone)?.label}
                  <ChevronDown className="size-3.5" />
                </button>
                {showToneMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowToneMenu(false)} />
                    <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-xl border border-gray-200 shadow-lg py-1 min-w-[150px]">
                      {TONE_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => {
                            setTone(opt.value)
                            setShowToneMenu(false)
                          }}
                          className={cn(
                            "w-full text-left px-3 py-2 text-sm transition",
                            opt.value === tone
                              ? "bg-blue-50 text-blue-700 font-medium"
                              : "text-gray-700 hover:bg-gray-50"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Generate / Regenerate button */}
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Generating 3 options...
                  </>
                ) : replies.length > 0 ? (
                  <>
                    <RefreshCw className="size-4" />
                    Regenerate All
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    Generate Replies
                  </>
                )}
              </button>
            </div>
          )}

          {/* Error states */}
          {error === "upgrade_required" && (
            <div className="bg-gray-50 rounded-xl p-5 text-center space-y-2">
              <Lock className="size-6 text-gray-400 mx-auto" />
              <p className="text-sm text-gray-600 font-medium">Upgrade required</p>
              {onUpgrade && (
                <button
                  onClick={onUpgrade}
                  className="text-blue-600 text-sm font-medium hover:underline"
                >
                  View plans
                </button>
              )}
            </div>
          )}
          {error === "no_profile" && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center space-y-2">
              <p className="text-sm text-amber-700 font-medium">No product profile set up</p>
              <p className="text-xs text-amber-600">
                Go to Settings to configure your product profile before generating replies.
              </p>
              <a
                href="/settings"
                className="inline-block text-blue-600 text-sm font-medium hover:underline"
              >
                Go to Settings
              </a>
            </div>
          )}
          {error && error !== "upgrade_required" && error !== "no_profile" && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Loading state */}
          {isGenerating && (
            <div className="space-y-4 py-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-gray-50 rounded-xl p-4 animate-pulse space-y-2"
                >
                  <div className="h-3 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-200 rounded w-full" />
                  <div className="h-3 bg-gray-200 rounded w-5/6" />
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
                </div>
              ))}
            </div>
          )}

          {/* Reply cards */}
          {!isGenerating && replies.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">
                  {replies.length} Reply Option{replies.length !== 1 ? "s" : ""}
                </span>
                {dailyRemaining !== null && (
                  <span className="text-[11px] text-gray-400">
                    {dailyRemaining} generation{dailyRemaining !== 1 ? "s" : ""} remaining today
                  </span>
                )}
              </div>

              {replies.map((reply, index) => (
                <ReplyCard
                  key={index}
                  index={index}
                  reply={reply}
                  isEditing={editingIndex === index}
                  editValue={editValue}
                  isCopied={copiedIndex === index}
                  onCopy={() => handleCopy(reply.text, index)}
                  onStartEdit={() => startEdit(index)}
                  onSaveEdit={saveEdit}
                  onCancelEdit={() => setEditingIndex(null)}
                  onEditChange={setEditValue}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// ReplyCard
// ---------------------------------------------------------------------------

interface ReplyCardProps {
  index: number
  reply: GeneratedReply
  isEditing: boolean
  editValue: string
  isCopied: boolean
  onCopy: () => void
  onStartEdit: () => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onEditChange: (val: string) => void
}

function ReplyCard({
  index,
  reply,
  isEditing,
  editValue,
  isCopied,
  onCopy,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onEditChange,
}: ReplyCardProps) {
  const label = reply.mentions_product
    ? `Option ${index + 1} — With product mention`
    : `Option ${index + 1} — No product mention`

  const labelColor = reply.mentions_product
    ? "text-blue-600 bg-blue-50 border-blue-200"
    : "text-gray-500 bg-gray-50 border-gray-200"

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50/50 border-b border-gray-100">
        <span
          className={cn(
            "text-[11px] font-semibold px-2 py-0.5 rounded-full border",
            labelColor
          )}
        >
          {label}
        </span>
        <span className="text-[11px] text-gray-400 italic">
          {reply.approach}
        </span>
      </div>

      {/* Reply text / editor */}
      <div className="p-4">
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editValue}
              onChange={(e) => onEditChange(e.target.value)}
              rows={6}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={onCancelEdit}
                className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={onSaveEdit}
                className="text-xs text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition font-medium"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {reply.text}
          </p>
        )}
      </div>

      {/* Actions */}
      {!isEditing && (
        <div className="flex items-center gap-1 px-4 py-2.5 border-t border-gray-100">
          <button
            onClick={onCopy}
            className={cn(
              "inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition font-medium",
              isCopied
                ? "text-green-600 bg-green-50"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            )}
          >
            {isCopied ? (
              <>
                <Check className="size-3.5" />
                Copied
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                Copy
              </>
            )}
          </button>
          <button
            onClick={onStartEdit}
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition font-medium"
          >
            <Pencil className="size-3.5" />
            Edit
          </button>
        </div>
      )}
    </div>
  )
}
