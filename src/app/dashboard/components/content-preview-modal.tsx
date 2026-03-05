'use client'

import { useState, useEffect, useCallback, useRef } from "react"
import { cn } from "@/lib/utils"
import {
  X,
  Copy,
  Check,
  Download,
  RefreshCw,
  Code,
  FileText,
  Loader2,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GeneratedContent {
  id: string
  title: string
  body: string
  metadata: Record<string, unknown>
}

interface ContentPreviewModalProps {
  open: boolean
  content: GeneratedContent | null
  onClose: () => void
  onRegenerate: () => void
  isRegenerating?: boolean
}

// ---------------------------------------------------------------------------
// Markdown → HTML converter (client-side, no extra deps)
// ---------------------------------------------------------------------------

function markdownToBasicHtml(md: string): string {
  let html = md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/^(\d+)\. (.+)$/gm, "<li>$2</li>")
    .replace(/\n{2,}/g, "\n\n")

  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>\n$1</ul>")

  const tableRegex = /\|(.+)\|\n\|[-| :]+\|\n((?:\|.+\|\n?)+)/g
  html = html.replace(tableRegex, (_match, headerRow, bodyRows) => {
    const headers = headerRow
      .split("|")
      .map((h: string) => h.trim())
      .filter(Boolean)
    const rows = bodyRows
      .trim()
      .split("\n")
      .map((row: string) =>
        row
          .split("|")
          .map((c: string) => c.trim())
          .filter(Boolean)
      )

    const headerHtml = headers.map((h: string) => `<th>${h}</th>`).join("")
    const bodyHtml = rows
      .map(
        (row: string[]) =>
          `<tr>${row.map((c: string) => `<td>${c}</td>`).join("")}</tr>`
      )
      .join("\n")

    return `<table>\n<thead><tr>${headerHtml}</tr></thead>\n<tbody>\n${bodyHtml}\n</tbody>\n</table>`
  })

  html = html
    .split("\n\n")
    .map((block: string) => {
      const trimmed = block.trim()
      if (
        trimmed.startsWith("<h") ||
        trimmed.startsWith("<ul") ||
        trimmed.startsWith("<ol") ||
        trimmed.startsWith("<table") ||
        trimmed.startsWith("<li") ||
        !trimmed
      )
        return trimmed
      return `<p>${trimmed}</p>`
    })
    .join("\n")

  return html
}

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------

export function ContentPreviewModal({
  open,
  content,
  onClose,
  onRegenerate,
  isRegenerating = false,
}: ContentPreviewModalProps) {
  const [copiedState, setCopiedState] = useState<"none" | "markdown" | "html">("none")
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    if (open) document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [open, onClose])

  const handleCopyMarkdown = useCallback(async () => {
    if (!content) return
    await navigator.clipboard.writeText(content.body)
    setCopiedState("markdown")
    setTimeout(() => setCopiedState("none"), 2000)
  }, [content])

  const handleCopyHtml = useCallback(async () => {
    if (!content) return
    const html = markdownToBasicHtml(content.body)
    await navigator.clipboard.writeText(html)
    setCopiedState("html")
    setTimeout(() => setCopiedState("none"), 2000)
  }, [content])

  const handleDownload = useCallback(() => {
    if (!content) return
    const slug = content.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60)
    const filename = `${slug}.md`

    const blob = new Blob([content.body], { type: "text/markdown;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [content])

  if (!open || !content) return null

  const typeLabel =
    (content.metadata?.type as string)?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ||
    "Content"
  const modelLabel = (content.metadata?.model as string) || ""

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="content-preview-title"
      >
        <div
          className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 shrink-0">
            <div className="min-w-0 flex-1 mr-4">
              <h2
                id="content-preview-title"
                className="text-lg font-bold text-gray-900 truncate"
              >
                {content.title}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {typeLabel}
                </span>
                {modelLabel && (
                  <span className="text-xs text-gray-400">
                    Generated with {modelLabel}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2 px-6 py-3 border-b border-gray-50 bg-gray-50/50 shrink-0 flex-wrap">
            <ToolbarButton
              icon={<FileText className="size-3.5" />}
              label={copiedState === "markdown" ? "Copied!" : "Copy as Markdown"}
              active={copiedState === "markdown"}
              onClick={handleCopyMarkdown}
            />
            <ToolbarButton
              icon={<Code className="size-3.5" />}
              label={copiedState === "html" ? "Copied!" : "Copy as HTML"}
              active={copiedState === "html"}
              onClick={handleCopyHtml}
            />
            <ToolbarButton
              icon={<Download className="size-3.5" />}
              label="Download .md"
              onClick={handleDownload}
            />
            <div className="flex-1" />
            <ToolbarButton
              icon={
                isRegenerating ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )
              }
              label={isRegenerating ? "Regenerating..." : "Regenerate"}
              onClick={onRegenerate}
              disabled={isRegenerating}
              variant="blue"
            />
          </div>

          {/* Content area */}
          <div
            ref={contentRef}
            className="flex-1 overflow-y-auto px-6 py-6 min-h-0"
          >
            {isRegenerating ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <Loader2 className="size-8 animate-spin mb-4" />
                <p className="text-sm">Regenerating content...</p>
              </div>
            ) : (
              <div className="prose prose-sm sm:prose max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-strong:text-gray-900 prose-table:border-collapse prose-th:bg-gray-50 prose-th:border prose-th:border-gray-200 prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:text-sm prose-th:font-semibold prose-td:border prose-td:border-gray-200 prose-td:px-3 prose-td:py-2 prose-td:text-sm prose-li:text-gray-700 prose-blockquote:border-l-blue-300 prose-blockquote:bg-blue-50/50 prose-blockquote:py-1 prose-hr:border-gray-200">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content.body}
                </ReactMarkdown>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 bg-gray-50/50 shrink-0 text-xs text-gray-400">
            <span>{content.body.length.toLocaleString()} characters</span>
            <span>
              Tip: Paste this content on your website to improve AI visibility
            </span>
          </div>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// ToolbarButton
// ---------------------------------------------------------------------------

function ToolbarButton({
  icon,
  label,
  onClick,
  active = false,
  disabled = false,
  variant = "default",
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
  variant?: "default" | "blue"
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition",
        disabled && "opacity-50 cursor-not-allowed",
        variant === "blue"
          ? "text-blue-600 hover:text-blue-700 hover:bg-blue-50 border border-blue-200"
          : active
            ? "text-green-600 bg-green-50 border border-green-200"
            : "text-gray-600 hover:text-gray-900 hover:bg-white border border-gray-200"
      )}
    >
      {active ? <Check className="size-3.5 text-green-500" /> : icon}
      {label}
    </button>
  )
}
