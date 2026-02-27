import { Worker, Job } from "bullmq"
import { getRedisConnection } from "@/lib/queue/connection"
import { runScan } from "@/lib/scan-runner"
import { generateStrategicPlan } from "@/lib/strategic/generate-plan"
import { computeProviderComparison } from "@/lib/scan-v3/scoring/provider-comparison"
import { createAdminClient } from "@/lib/supabase-admin"
import { log } from "@/lib/logger"
import type { ScanJobData, ScanJobResult } from "@/lib/queue/scan-queue"

const logger = log.create("scan-worker")

async function processScanJob(job: Job<ScanJobData, ScanJobResult>): Promise<ScanJobResult> {
  const { scanId, userId, brandName, brandUrl, brandId, category, planTier } = job.data

  logger.info("Job received", { jobId: job.id, scanId, brand: brandName, plan: planTier })

  const db = createAdminClient()

  // Mark scan as processing
  await db
    .from("scans")
    .update({ status: "processing" })
    .eq("id", scanId)

  try {
    await job.updateProgress(10)

    const result = await runScan({
      scanId,
      userId,
      brandName,
      brandUrl,
      category,
      planTier,
      input: {
        brand_name: brandName,
        website_url: brandUrl,
        core_problem: job.data.coreProblem || "",
        target_buyer: job.data.targetBuyer || "",
        differentiators: job.data.differentiators || undefined,
        competitors: job.data.competitors || [],
        buyer_questions: job.data.buyerQuestions || [],
        plan_tier: planTier,
      },
    })

    await job.updateProgress(80)

    try {
      const comparison = await computeProviderComparison(scanId, db)
      const { data: existing } = await db
        .from("scans")
        .select("summary")
        .eq("id", scanId)
        .single()

      await db
        .from("scans")
        .update({
          summary: {
            ...(existing?.summary as Record<string, unknown> ?? {}),
            provider_comparison: comparison,
          },
        })
        .eq("id", scanId)
    } catch (compErr) {
      logger.error("Provider comparison failed (non-fatal)", {
        scanId,
        error: compErr instanceof Error ? compErr.message : String(compErr),
      })
    }

    await job.updateProgress(85)

    // Generate strategic plan
    await db
      .from("scans")
      .update({ status: "generating_strategy", stage: "strategy" })
      .eq("id", scanId)

    try {
      const { persisted } = await generateStrategicPlan(scanId)
      if (!persisted) {
        logger.warn("Strategic plan generated but not persisted", { scanId })
      }
    } catch (strategyErr) {
      logger.error("Strategic plan generation failed (non-fatal)", {
        scanId,
        error: strategyErr instanceof Error ? strategyErr.message : String(strategyErr),
      })
      await db
        .from("scans")
        .update({ status: "strategy_failed" })
        .eq("id", scanId)
    }

    await job.updateProgress(100)

    await db
      .from("scans")
      .update({
        status: result.score > 0 ? "recommended" : "not_mentioned",
        stage: "complete",
      })
      .eq("id", scanId)

    // Update subscription usage
    if (userId) {
      const { data: subscription } = await db
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .single()

      if (!subscription) {
        await db
          .from("brands")
          .update({ free_scan_used: true })
          .eq("user_id", userId)
      } else if (subscription.plan === "starter") {
        await db
          .from("subscriptions")
          .update({
            scans_used_this_period: (subscription.scans_used_this_period || 0) + 1,
          })
          .eq("id", subscription.id)
      }
    }

    logger.info("Job completed successfully", {
      jobId: job.id,
      scanId,
      brand: brandName,
      score: result.score,
    })

    return { success: true, score: result.score }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error"

    // Mark scan as failed
    await db
      .from("scans")
      .update({ status: "failed" })
      .eq("id", scanId)

    logger.error("Job processing failed", {
      jobId: job.id,
      scanId,
      brand: brandName,
      error: errorMsg,
    })

    return { success: false, error: errorMsg }
  }
}

let worker: Worker<ScanJobData, ScanJobResult> | null = null

export function startScanWorker() {
  if (worker) return worker

  worker = new Worker<ScanJobData, ScanJobResult>("scan", processScanJob, {
    connection: getRedisConnection(),
    concurrency: 2,
  })

  worker.on("completed", (job) => {
    logger.info("Job finished", { jobId: job.id, brand: job.data.brandName })
  })

  worker.on("failed", (job, err) => {
    logger.error("Job failed", {
      jobId: job?.id,
      brand: job?.data.brandName,
      error: err.message,
    })
  })

  logger.info("Scan worker started", { concurrency: 2 })
  return worker
}
