import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { PLAYBOOK_TASKS } from "@/lib/playbook/playbook-tasks"
import { log } from "@/lib/logger"

const logger = log.create("playbook-complete")
export const dynamic = "force-dynamic"

const PLAYBOOK_IDS = new Set(PLAYBOOK_TASKS.map((t) => t.id))

// ---------------------------------------------------------------------------
// POST /api/playbook/complete
// Body: { task_id: string, undo?: boolean }
// Appends or removes task_id from the user's completed_items array
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body: { task_id?: string; undo?: boolean }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const { task_id, undo } = body

    if (!task_id || !PLAYBOOK_IDS.has(task_id)) {
      return NextResponse.json({ error: "Invalid task_id" }, { status: 400 })
    }

    // Fetch current completed items
    const { data: existing } = await supabase
      .from("user_checklist")
      .select("completed_items")
      .eq("user_id", user.id)
      .single()

    let items: string[] = existing?.completed_items || []

    if (undo) {
      items = items.filter((id) => id !== task_id)
    } else {
      if (!items.includes(task_id)) {
        items = [...items, task_id]
      }
    }

    // Upsert
    const { error: upsertError } = await supabase
      .from("user_checklist")
      .upsert(
        {
          user_id: user.id,
          completed_items: items,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )

    if (upsertError) {
      logger.error("Failed to update playbook progress", { error: upsertError.message })
      return NextResponse.json({ error: "Failed to save progress" }, { status: 500 })
    }

    const playbookCompleted = items.filter((id) => PLAYBOOK_IDS.has(id))

    logger.info("Playbook task updated", {
      taskId: task_id,
      action: undo ? "uncompleted" : "completed",
      totalCompleted: playbookCompleted.length,
    })

    return NextResponse.json({
      completed_tasks: playbookCompleted,
      total_tasks: PLAYBOOK_TASKS.length,
    })
  } catch (err) {
    logger.error("Playbook complete error", { error: String(err) })
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
