import type { PlaybookTask } from "./playbook-tasks"

// ---------------------------------------------------------------------------
// Scan context passed in from the dashboard
// ---------------------------------------------------------------------------

export interface PlaybookScanData {
  score: number
  mention_rate: number
  provider_scores?: Record<string, number>
}

// ---------------------------------------------------------------------------
// getPriorityTasks — returns the top 3 incomplete, relevant tasks
// sorted by priority then score_impact. Runs on the frontend, no API call.
// ---------------------------------------------------------------------------

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
}

export function getPriorityTasks(
  tasks: PlaybookTask[],
  completedIds: Set<string>,
  scanData: PlaybookScanData
): PlaybookTask[] {
  const { score, mention_rate, provider_scores } = scanData

  // 1. Filter out completed tasks
  const incomplete = tasks.filter((t) => !completedIds.has(t.id))

  // 2. Filter to relevant tasks based on scan data
  const relevant = incomplete.filter((t) => {
    const cond = t.relevant_when

    if (cond.score_below !== undefined && score >= cond.score_below) return false
    if (cond.score_above !== undefined && score <= cond.score_above) return false
    if (cond.mention_rate_below !== undefined && mention_rate >= cond.mention_rate_below) return false

    if (cond.provider_gap) {
      if (!provider_scores) return false
      const scores = Object.values(provider_scores)
      if (scores.length < 2) return false
      const gap = Math.max(...scores) - Math.min(...scores)
      if (gap < 20) return false
    }

    return true
  })

  // 3. Sort by priority (critical > high > medium), then by score_impact desc
  relevant.sort((a, b) => {
    const pDiff = (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2)
    if (pDiff !== 0) return pDiff
    return b.score_impact - a.score_impact
  })

  // 4. Return top 3
  return relevant.slice(0, 3)
}
