'use client'

import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { PLAYBOOK_TASKS } from "@/lib/playbook/playbook-tasks"
import { getPriorityTasks, type PlaybookScanData } from "@/lib/playbook/get-priority-tasks"
import type { PlaybookTask } from "@/lib/playbook/playbook-tasks"
import Link from "next/link"
import {
  ArrowRight,
  Check,
  Clock,
  ExternalLink,
  Loader2,
  Sparkles,
  TrendingUp,
  RefreshCw,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PlaybookPreviewProps {
  score: number
  mentionRate: number
  providerScores?: Record<string, number>
}

// ---------------------------------------------------------------------------
// Priority badge config
// ---------------------------------------------------------------------------

const PRIORITY_STYLE: Record<string, { classes: string; label: string }> = {
  critical: { classes: "bg-red-100 text-red-700 border-red-200", label: "CRITICAL" },
  high: { classes: "bg-amber-100 text-amber-700 border-amber-200", label: "HIGH" },
  medium: { classes: "bg-blue-100 text-blue-700 border-blue-200", label: "MEDIUM" },
}

// ---------------------------------------------------------------------------
// PlaybookPreview
// ---------------------------------------------------------------------------

export function PlaybookPreview({ score, mentionRate, providerScores }: PlaybookPreviewProps) {
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [markingDone, setMarkingDone] = useState<string | null>(null)

  // Fetch progress
  const fetchProgress = useCallback(async () => {
    try {
      const res = await fetch("/api/playbook/progress")
      if (!res.ok) return
      const data = await res.json()
      setCompletedIds(new Set(data.completed_tasks || []))
    } catch {
      // non-fatal
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProgress()
  }, [fetchProgress])

  // Mark done / undo
  const handleToggleComplete = async (taskId: string, undo: boolean) => {
    setMarkingDone(taskId)
    try {
      const res = await fetch("/api/playbook/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId, undo }),
      })
      if (!res.ok) return
      const data = await res.json()
      setCompletedIds(new Set(data.completed_tasks || []))
    } catch {
      // non-fatal
    } finally {
      setMarkingDone(null)
    }
  }

  const scanData: PlaybookScanData = {
    score,
    mention_rate: mentionRate / 100,
    provider_scores: providerScores,
  }

  const totalTasks = PLAYBOOK_TASKS.length
  const completedCount = completedIds.size
  const progressPct = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0

  const priorityTasks = getPriorityTasks(PLAYBOOK_TASKS, completedIds, scanData)

  // Estimated impact — sum of incomplete relevant tasks, capped at distance to 100
  const allIncomplete = PLAYBOOK_TASKS.filter((t) => !completedIds.has(t.id))
  const rawImpact = allIncomplete.reduce((sum, t) => sum + t.score_impact, 0)
  const estimatedImpact = Math.min(rawImpact, 100 - score)

  // All tasks complete state
  const allComplete = completedCount >= totalTasks
  const allRelevantComplete = priorityTasks.length === 0 && !allComplete

  if (isLoading) {
    return (
      <section>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 text-gray-400 animate-spin" />
          </div>
        </div>
      </section>
    )
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="size-5 text-blue-500" />
            Improve Your AI Visibility
          </h2>
        </div>
        <Link
          href="/checklist"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1 transition"
        >
          View Full Playbook
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{completedCount}/{totalTasks}</span> steps completed
            </span>
            {estimatedImpact > 0 && !allComplete && (
              <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                <TrendingUp className="size-3.5" />
                +{estimatedImpact} points possible
              </span>
            )}
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* All complete */}
        {allComplete && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-green-700 font-semibold">
              <Check className="size-5" />
              AI Visibility Playbook: Complete
            </div>
            <p className="text-sm text-green-600">
              You&apos;ve completed all visibility optimization steps.
              Run a new scan to measure your improvement.
            </p>
            <Link
              href="/check"
              className="inline-flex items-center gap-1.5 bg-green-600 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-green-700 transition mt-1"
            >
              <RefreshCw className="size-3.5" />
              Run New Scan
            </Link>
          </div>
        )}

        {/* All relevant tasks complete but score still low */}
        {allRelevantComplete && !allComplete && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-center space-y-1">
            <p className="text-sm text-blue-700 font-medium">
              You&apos;ve completed all recommended steps for your current score.
            </p>
            <p className="text-xs text-blue-600">
              Run a new scan to see if your score has improved. It can take 2–4 weeks for AI models to update.
            </p>
          </div>
        )}

        {/* No scan data */}
        {score === 0 && !allComplete && priorityTasks.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-700">
            Run your first scan, then complete these steps to improve your score.
          </div>
        )}

        {/* Priority task cards */}
        {!allComplete && priorityTasks.length > 0 && (
          <div className="space-y-3">
            {priorityTasks.map((task) => (
              <PriorityTaskCard
                key={task.id}
                task={task}
                isCompleting={markingDone === task.id}
                onMarkDone={() => handleToggleComplete(task.id, false)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// PriorityTaskCard
// ---------------------------------------------------------------------------

function PriorityTaskCard({
  task,
  isCompleting,
  onMarkDone,
}: {
  task: PlaybookTask
  isCompleting: boolean
  onMarkDone: () => void
}) {
  const style = PRIORITY_STYLE[task.priority] || PRIORITY_STYLE.medium

  return (
    <div className="border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Priority badge + time */}
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className={cn(
                "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                style.classes
              )}
            >
              {style.label}
            </span>
            <span className="text-[11px] text-gray-400 flex items-center gap-1">
              <Clock className="size-3" />
              {task.estimated_minutes} min
            </span>
            <span className="text-[11px] text-green-600 font-medium">
              +{task.score_impact} pts
            </span>
          </div>

          {/* Title + description */}
          <h4 className="text-sm font-semibold text-gray-900">{task.title}</h4>
          <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{task.description}</p>
        </div>

        {/* Actions */}
        <div className="shrink-0 flex flex-col gap-1.5 items-end">
          {task.external_url && (
            <a
              href={task.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition"
            >
              Start Fix
              <ExternalLink className="size-3" />
            </a>
          )}
          <button
            onClick={onMarkDone}
            disabled={isCompleting}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 hover:text-green-600 hover:border-green-200 transition disabled:opacity-50"
          >
            {isCompleting ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Check className="size-3" />
            )}
            Mark Done
          </button>
        </div>
      </div>
    </div>
  )
}
