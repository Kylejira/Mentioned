import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { runScan } from "@/lib/scan-runner"
import { log } from "@/lib/logger"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const logger = log.create("cron-recurring-scans")

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  const header = request.headers.get("authorization")
  return header === `Bearer ${secret}`
}

function computeNextRun(interval: string, from: Date): Date {
  const next = new Date(from)
  if (interval === "weekly") {
    next.setDate(next.getDate() + 7)
  } else {
    next.setMonth(next.getMonth() + 1)
  }
  return next
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db = createAdminClient()
  const now = new Date().toISOString()

  const { data: dueScans, error } = await db
    .from("scans")
    .select("id, brand_id, core_problem, target_buyer, differentiators, buyer_questions, saas_profile, is_recurring, recurring_interval")
    .eq("is_recurring", true)
    .lte("next_run_at", now)
    .order("next_run_at", { ascending: true })
    .limit(20)

  if (error) {
    logger.error("Failed to fetch due scans", { error: error.message })
    return NextResponse.json({ error: "Database error" }, { status: 500 })
  }

  if (!dueScans || dueScans.length === 0) {
    logger.info("No recurring scans due")
    return NextResponse.json({ processed: 0 })
  }

  logger.info("Found due recurring scans", { count: dueScans.length })

  let processed = 0
  let failed = 0

  const isQueueEnabled = !!process.env.REDIS_URL

  for (const scan of dueScans) {
    try {
      const profile = scan.saas_profile as Record<string, unknown> | null
      const brandName = (profile?.brand_name as string) || "Unknown"
      const brandUrl = (profile?.website_url as string) || ""
      const category = (profile?.category as string) || undefined

      if (!brandUrl) {
        logger.warn("Skipping scan with no brand URL", { scanId: scan.id })
        continue
      }

      const newScanId = `recurring_${scan.id}_${Date.now()}`

      await db.from("scans").insert({
        id: newScanId,
        brand_id: scan.brand_id || null,
        status: isQueueEnabled ? "queued" : "processing",
        scan_version: "v3",
        core_problem: scan.core_problem || null,
        target_buyer: scan.target_buyer || null,
        differentiators: scan.differentiators || null,
        buyer_questions: scan.buyer_questions || [],
      })

      if (isQueueEnabled) {
        const { getScanQueue } = await import("@/lib/queue")
        await getScanQueue().add("scan", {
          scanId: newScanId,
          userId: null,
          brandName,
          brandUrl,
          brandId: scan.brand_id || undefined,
          category,
          coreProblem: (scan.core_problem as string) || "",
          targetBuyer: (scan.target_buyer as string) || "",
          differentiators: (scan.differentiators as string) || undefined,
          competitors: [],
          buyerQuestions: (scan.buyer_questions as string[]) || [],
          planTier: "pro",
        }, { jobId: newScanId })
      } else {
        runScan({
          scanId: newScanId,
          userId: null,
          brandName,
          brandUrl,
          category,
          planTier: "pro",
          input: {
            brand_name: brandName,
            website_url: brandUrl,
            core_problem: (scan.core_problem as string) || "",
            target_buyer: (scan.target_buyer as string) || "",
            differentiators: (scan.differentiators as string) || undefined,
            competitors: [],
            buyer_questions: (scan.buyer_questions as string[]) || [],
            plan_tier: "pro",
          },
        }).catch((err) => {
          logger.error("Sync recurring scan failed", { scanId: newScanId, error: String(err) })
        })
      }

      const nextRun = computeNextRun(
        scan.recurring_interval || "monthly",
        new Date()
      )

      await db
        .from("scans")
        .update({ next_run_at: nextRun.toISOString() })
        .eq("id", scan.id)

      processed++
      logger.info("Recurring scan triggered", {
        originalScanId: scan.id,
        newScanId,
        nextRun: nextRun.toISOString(),
      })
    } catch (err) {
      failed++
      logger.error("Failed to process recurring scan", {
        scanId: scan.id,
        error: String(err),
      })
    }
  }

  return NextResponse.json({ processed, failed, total: dueScans.length })
}
