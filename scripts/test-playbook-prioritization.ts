import { PLAYBOOK_TASKS } from "../src/lib/playbook/playbook-tasks"
import { getPriorityTasks, type PlaybookScanData } from "../src/lib/playbook/get-priority-tasks"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let passed = 0
let failed = 0

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✅ ${label}`)
    passed++
  } else {
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`)
    failed++
  }
}

function printTasks(tasks: ReturnType<typeof getPriorityTasks>) {
  if (tasks.length === 0) {
    console.log("    (no tasks)")
    return
  }
  tasks.forEach((t, i) => {
    console.log(
      `    ${i + 1}. [${t.priority.toUpperCase()}] ${t.title} (${t.category}, +${t.score_impact} pts, relevant when: ${JSON.stringify(t.relevant_when)})`
    )
  })
}

// ---------------------------------------------------------------------------
// TEST 1 — Score 0 (brand new user, no scan data)
// ---------------------------------------------------------------------------

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
console.log("TEST 1: Score 0 — Should show setup/critical tasks")
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

const scan0: PlaybookScanData = { score: 0, mention_rate: 0 }
const tasks0 = getPriorityTasks(PLAYBOOK_TASKS, new Set(), scan0)
printTasks(tasks0)

assert("Returns exactly 3 tasks", tasks0.length === 3)
assert(
  "All tasks are critical or high priority",
  tasks0.every((t) => t.priority === "critical" || t.priority === "high")
)
assert(
  "First task is critical",
  tasks0[0]?.priority === "critical",
  `Got: ${tasks0[0]?.priority}`
)
assert(
  "Setup tasks appear (bing-webmaster, fix-crawl-blockers expected)",
  tasks0.some((t) => t.category === "setup"),
  `Categories: ${tasks0.map((t) => t.category).join(", ")}`
)
assert(
  "fix-crawl-blockers is present (critical, +10 pts, score_below: 30)",
  tasks0.some((t) => t.id === "fix-crawl-blockers")
)

// ---------------------------------------------------------------------------
// TEST 2 — Score 50, mention rate 20%
// ---------------------------------------------------------------------------

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
console.log("TEST 2: Score 50, mention rate 20% — Content/optimization tasks")
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

const scan50: PlaybookScanData = { score: 50, mention_rate: 0.2 }
const tasks50 = getPriorityTasks(PLAYBOOK_TASKS, new Set(), scan50)
printTasks(tasks50)

assert("Returns exactly 3 tasks", tasks50.length === 3)
assert(
  "Setup tasks with score_below 30 or 40 are excluded",
  !tasks50.some((t) => t.id === "fix-crawl-blockers" || t.id === "bing-webmaster" || t.id === "google-search-console"),
  `Found: ${tasks50.map((t) => t.id).join(", ")}`
)
assert(
  "Content or optimization tasks appear",
  tasks50.some((t) => t.category === "content" || t.category === "optimization"),
  `Categories: ${tasks50.map((t) => t.category).join(", ")}`
)
assert(
  "create-comparison-content is present (high, +15 pts, mention_rate_below: 0.5)",
  tasks50.some((t) => t.id === "create-comparison-content")
)
assert(
  "publish-trusted-platforms is present (high, +12 pts, mention_rate_below: 0.3)",
  tasks50.some((t) => t.id === "publish-trusted-platforms")
)

// ---------------------------------------------------------------------------
// TEST 3 — Score 85, mention rate 60%
// ---------------------------------------------------------------------------

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
console.log("TEST 3: Score 85, mention rate 60% — Should show few or no tasks")
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

const scan85: PlaybookScanData = { score: 85, mention_rate: 0.6 }
const tasks85 = getPriorityTasks(PLAYBOOK_TASKS, new Set(), scan85)
printTasks(tasks85)

const relevantAt85 = PLAYBOOK_TASKS.filter((t) => {
  const c = t.relevant_when
  if (c.score_below !== undefined && 85 >= c.score_below) return false
  if (c.mention_rate_below !== undefined && 0.6 >= c.mention_rate_below) return false
  return true
})

assert(
  `Few tasks relevant at score 85 (${relevantAt85.length} total relevant)`,
  relevantAt85.length <= 3,
  `Relevant IDs: ${relevantAt85.map((t) => t.id).join(", ")}`
)

if (tasks85.length === 0) {
  console.log("  ℹ️  No tasks relevant — dashboard should show completion/maintenance message")
} else {
  assert(
    "Remaining tasks are medium priority or maintenance-oriented",
    tasks85.every((t) => t.priority === "medium" || t.category === "maintenance"),
    `Got: ${tasks85.map((t) => `${t.id}(${t.priority}/${t.category})`).join(", ")}`
  )
}

// ---------------------------------------------------------------------------
// TEST 4 — Completing a task slides in the next priority task
// ---------------------------------------------------------------------------

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
console.log("TEST 4: Completing a task reveals the next priority task")
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

const scanSlide: PlaybookScanData = { score: 30, mention_rate: 0.15 }
const round1 = getPriorityTasks(PLAYBOOK_TASKS, new Set(), scanSlide)
console.log("  Round 1 (nothing completed):")
printTasks(round1)

const completedFirst = new Set([round1[0].id])
const round2 = getPriorityTasks(PLAYBOOK_TASKS, completedFirst, scanSlide)
console.log(`\n  Round 2 (completed "${round1[0].title}"):`);
printTasks(round2)

assert(
  "Completed task is gone from round 2",
  !round2.some((t) => t.id === round1[0].id)
)
assert(
  "A new task slid into the 3rd slot",
  round2.length === 3,
  `Got ${round2.length} tasks`
)
assert(
  "New task was not in round 1",
  round2.some((t) => !round1.map((r) => r.id).includes(t.id)),
  `Round 2 IDs: ${round2.map((t) => t.id).join(", ")}`
)

const completedTwo = new Set([round1[0].id, round2[0].id])
const round3 = getPriorityTasks(PLAYBOOK_TASKS, completedTwo, scanSlide)
console.log(`\n  Round 3 (also completed "${round2[0].title}"):`);
printTasks(round3)

assert(
  "Both completed tasks are gone from round 3",
  !round3.some((t) => completedTwo.has(t.id))
)
assert(
  "Still returns up to 3 tasks",
  round3.length <= 3 && round3.length > 0
)

// ---------------------------------------------------------------------------
// TEST 5 — All tasks complete
// ---------------------------------------------------------------------------

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
console.log("TEST 5: All tasks marked complete — Should return empty")
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

const allDone = new Set(PLAYBOOK_TASKS.map((t) => t.id))
const tasksAllDone = getPriorityTasks(PLAYBOOK_TASKS, allDone, scan0)
printTasks(tasksAllDone)

assert("Returns 0 tasks when all complete", tasksAllDone.length === 0)

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
console.log(`RESULTS: ${passed} passed, ${failed} failed`)
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

process.exit(failed > 0 ? 1 : 0)
