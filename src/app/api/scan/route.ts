import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { createAdminClient } from "@/lib/supabase-admin"
import { validateScanInput, type ScanInput } from "@/lib/scan-v3"
import type { PlanTier } from "@/lib/scan-v3"
import { runScan } from "@/lib/scan-runner"
import { generateStrategicPlan } from "@/lib/strategic/generate-plan"
import { computeProviderComparison } from "@/lib/scan-v3/scoring/provider-comparison"
import { computeScoreDeltas } from "@/lib/scan-v3/scoring/compute-deltas"
import { computeShareOfVoice } from "@/lib/scan-v3/scoring/share-of-voice"
import { canUseStrategicBrain } from "@/lib/plans/enforce"
import { log } from "@/lib/logger"

export const maxDuration = 240
export const dynamic = "force-dynamic"

const logger = log.create("scan-api")
const PRO_WHITELIST = (process.env.PRO_WHITELIST_EMAILS || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean)

function isQueueEnabled(): boolean {
  return !!process.env.REDIS_URL
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      logger.error("OpenAI API key not configured")
      return NextResponse.json(
        { error: "OpenAI API key required. Please add OPENAI_API_KEY in environment variables." },
        { status: 500 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // ── Subscription / quota checks ──
    let planTier: PlanTier = "free"
    let effectivePlan = "free"
    if (user) {
      const isWhitelisted = PRO_WHITELIST.includes(user.email?.toLowerCase() || "")

      if (isWhitelisted) {
        planTier = "pro"
        effectivePlan = "pro_monthly"
      } else {
        const { data: subscription } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "active")
          .single()

        const { data: brand } = await supabase
          .from("brands")
          .select("free_scan_used")
          .eq("user_id", user.id)
          .single()

        const freeScanUsed = brand?.free_scan_used || false

        if (!subscription) {
          if (freeScanUsed) {
            return NextResponse.json(
              {
                error: "upgrade_required",
                message: "You've used your free scan. Upgrade to run more scans.",
                upgradeRequired: true,
              },
              { status: 403 }
            )
          }
        } else if (subscription.plan === "starter") {
          planTier = "pro"
          effectivePlan = "starter"
          const scansUsed = subscription.scans_used_this_period || 0
          const scansLimit = subscription.scans_limit || 10

          if (scansUsed >= scansLimit) {
            return NextResponse.json(
              {
                error: "scan_limit_reached",
                message: `You've used all ${scansLimit} scans this month. Upgrade to Pro for unlimited scans.`,
                scansUsed,
                scansLimit,
                resetDate: subscription.current_period_end,
                upgradeRequired: true,
              },
              { status: 403 }
            )
          }
        } else if (subscription?.plan === "pro") {
          planTier = "pro"
          effectivePlan = subscription.plan
        } else if (subscription?.plan) {
          effectivePlan = subscription.plan
        }
      }
    }

    const {
      brandId,
      brandName,
      brandUrl,
      category,
      categories,
      competitors,
      customQueries,
      coreProblem,
      targetBuyer,
      differentiators,
      buyerQuestions,
      description,
    } = body

    if (!brandName || !brandUrl) {
      return NextResponse.json({ error: "Missing required fields: brandName, brandUrl" }, { status: 400 })
    }

    const scanInput: ScanInput = {
      brand_name: brandName,
      website_url: brandUrl,
      core_problem: coreProblem || description || "",
      target_buyer: targetBuyer || "",
      differentiators: differentiators || undefined,
      competitors: competitors || [],
      buyer_questions: buyerQuestions || customQueries || [],
      plan_tier: planTier,
    }

    if (coreProblem) {
      const validationErrors = validateScanInput(scanInput)
      if (validationErrors.length > 0) {
        return NextResponse.json(
          { error: validationErrors[0].message, validationErrors },
          { status: 400 }
        )
      }
    }

    const scanId = brandId || `v3_${Date.now()}`
    const resolvedCategory = category || categories?.[0]

    // ── Async mode: enqueue and return immediately ──
    if (isQueueEnabled()) {
      logger.info("Enqueueing scan (async)", { scanId, brand: brandName, url: brandUrl, plan: planTier })

      const adminDb = createAdminClient()

      // Create scan record with "queued" status
      await adminDb.from("scans").upsert({
        id: scanId,
        brand_id: brandId || null,
        status: "queued",
        scan_version: "v3",
        core_problem: coreProblem || null,
        target_buyer: targetBuyer || null,
        differentiators: differentiators || null,
        buyer_questions: buyerQuestions || customQueries || [],
      }, { onConflict: "id" })

      const { getScanQueue } = await import("@/lib/queue")

      await getScanQueue().add("scan", {
        scanId,
        userId: user?.id || null,
        brandName,
        brandUrl,
        brandId,
        category: resolvedCategory,
        coreProblem: coreProblem || description || "",
        targetBuyer: targetBuyer || "",
        differentiators: differentiators || undefined,
        competitors: competitors || [],
        buyerQuestions: buyerQuestions || customQueries || [],
        planTier,
        effectivePlan,
        userEmail: user?.email || undefined,
      }, { jobId: scanId })

      return NextResponse.json({ scanId, status: "queued" })
    }

    // ── Sync fallback: run inline when Redis is not available ──
    logger.info("Starting scan (sync)", { brand: brandName, url: brandUrl, plan: planTier })

    try {
      const result = await runScan({
        scanId,
        userId: user?.id || null,
        brandName,
        brandUrl,
        category: resolvedCategory,
        planTier,
        input: scanInput,
        effectivePlan,
      })

      if (user) {
        const isWhitelisted = PRO_WHITELIST.includes(user.email?.toLowerCase() || "")
        if (!isWhitelisted) {
          const { data: subscription } = await supabase
            .from("subscriptions")
            .select("*")
            .eq("user_id", user.id)
            .eq("status", "active")
            .single()

          if (!subscription) {
            await supabase
              .from("brands")
              .update({ free_scan_used: true })
              .eq("user_id", user.id)
          } else if (subscription.plan === "starter") {
            await supabase
              .from("subscriptions")
              .update({
                scans_used_this_period: (subscription.scans_used_this_period || 0) + 1,
              })
              .eq("id", subscription.id)
          }
        }
      }

      // Provider comparison + deltas + share of voice (non-blocking)
      let scanDeltas: Record<string, unknown> | null = null
      let scanShareOfVoice: Record<string, unknown> | null = null
      try {
        const adminDb = createAdminClient()
        const comparison = await computeProviderComparison(scanId, adminDb)
        const { data: existing } = await adminDb
          .from("scans")
          .select("summary")
          .eq("id", scanId)
          .single()

        let deltas = null
        try {
          const providerScores: Record<string, number> = {}
          if (comparison?.providers) {
            for (const p of comparison.providers) {
              providerScores[p.provider] = p.composite_score
            }
          }

          deltas = await computeScoreDeltas(scanId, brandId || scanId, {
            overall: result.score,
            mention_rate: comparison?.providers?.length
              ? comparison.providers.reduce((s, p) => s + p.mention_rate, 0) / comparison.providers.length
              : 0,
            consistency: comparison?.cross_provider?.consistency_score ?? 0,
            providerScores,
          }, adminDb)
          scanDeltas = deltas as unknown as Record<string, unknown>
        } catch (deltaErr) {
          logger.warn("Delta computation failed (non-fatal)", {
            scanId,
            error: deltaErr instanceof Error ? deltaErr.message : String(deltaErr),
          })
        }

        let shareOfVoice = null
        try {
          shareOfVoice = await computeShareOfVoice(scanId, brandName, adminDb)
          scanShareOfVoice = shareOfVoice as unknown as Record<string, unknown>
        } catch (sovErr) {
          logger.warn("Share of voice computation failed (non-fatal)", {
            scanId,
            error: sovErr instanceof Error ? sovErr.message : String(sovErr),
          })
        }

        await adminDb
          .from("scans")
          .update({
            summary: {
              ...(existing?.summary as Record<string, unknown> ?? {}),
              provider_comparison: comparison,
              ...(deltas ? { deltas } : {}),
              ...(shareOfVoice ? { share_of_voice: shareOfVoice } : {}),
            },
          })
          .eq("id", scanId)
      } catch (compErr) {
        logger.warn("Provider comparison failed (non-fatal)", {
          scanId,
          error: compErr instanceof Error ? compErr.message : String(compErr),
        })
      }

      // ENFORCEMENT 3: Strategic brain gated by plan
      if (canUseStrategicBrain(effectivePlan)) {
        try {
          await generateStrategicPlan(scanId)
        } catch (strategyErr) {
          logger.warn("Strategic plan generation failed (non-fatal)", {
            scanId,
            error: strategyErr instanceof Error ? strategyErr.message : String(strategyErr),
          })
        }
      } else {
        logger.info("Strategic plan skipped (plan does not include strategic brain)", { scanId, effectivePlan })
      }

      return NextResponse.json({
        ...result.legacyResult,
        _scanId: scanId,
        ...(scanDeltas ? { _deltas: scanDeltas } : {}),
        ...(scanShareOfVoice ? { _share_of_voice: scanShareOfVoice } : {}),
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      const stack = err instanceof Error ? err.stack?.split("\n").slice(0, 3).join(" | ") : ""
      logger.error("Scan failed", { error: msg, stack })
      return NextResponse.json(
        { error: `Scan failed: ${msg}`, phase: msg.match(/Phase \d+ \([^)]+\)/)?.[0] || "unknown" },
        { status: 500 }
      )
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    logger.error("Unexpected scan error", { error: errorMessage })
    return NextResponse.json(
      { error: `Scan failed: ${errorMessage}. Please try again.` },
      { status: 500 }
    )
  }
}
