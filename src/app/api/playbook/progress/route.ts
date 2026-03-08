import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { PLAYBOOK_TASKS } from "@/lib/playbook/playbook-tasks"
import { log } from "@/lib/logger"

const logger = log.create("playbook-progress")
export const dynamic = "force-dynamic"

const PLAYBOOK_IDS = new Set(PLAYBOOK_TASKS.map((t) => t.id))

// ---------------------------------------------------------------------------
// GET /api/playbook/progress
// Returns completed playbook task IDs and total count
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("user_checklist")
      .select("completed_items")
      .eq("user_id", user.id)
      .single()

    if (error && error.code !== "PGRST116") {
      logger.error("Failed to fetch playbook progress", { error: error.message })
      return NextResponse.json({ error: "Failed to fetch progress" }, { status: 500 })
    }

    const allCompleted: string[] = data?.completed_items || []
    const playbookCompleted = allCompleted.filter((id) => PLAYBOOK_IDS.has(id))

    return NextResponse.json({
      completed_tasks: playbookCompleted,
      total_tasks: PLAYBOOK_TASKS.length,
    })
  } catch (err) {
    logger.error("Playbook progress error", { error: String(err) })
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
